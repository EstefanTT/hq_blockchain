// core/market/priceEngine.js
// Orchestrates CoinGecko + CoinMarketCap price feeds, candle merging,
// volatility detection (normal ↔ violent mode), and divergence alerts.
// Multi-chain ready: instantiate with different token configs per chain.

import { getSimplePrices, getOhlcCandles } from '../../connectors/apis/coingecko/index.js';
import { getLatestPrices } from '../../connectors/apis/coinmarketcap/index.js';
import {
	updatePriceFeed,
	updateCandles,
	updatePriceEngineStatus,
	addDivergenceAlert,
	getSteemDexBotData,
} from '../../services/cache/index.js';
import { sendTelegramMessage } from '../../services/messaging/telegram.js';

// ─── Intervals (ms) ─────────────────────────────────────────

const INTERVALS = {
	normal:  { cgPrice: 30 * 60_000, cmcPrice: 6 * 60_000, candles: 30 * 60_000 },
	violent: { cgPrice: 2 * 60_000,  cmcPrice: 30_000,      candles: 30 * 60_000 },
};

// ─── Thresholds ──────────────────────────────────────────────

const VIOLENT_COOLDOWN_MS    = 15 * 60_000;   // 15 min calm → return to normal
const VOLATILITY_THRESHOLD   = 0.012;          // 1.2% high-low spread
const DIVERGENCE_THRESHOLD   = 0.008;          // 0.8% CG vs CMC gap
const DIVERGENCE_COOLDOWN_MS = 5 * 60_000;     // 5 min between same-coin alerts

// ─── Storage limits ──────────────────────────────────────────

const MAX_RAW_HOURS    = 4;
const MAX_HOURLY_HOURS = 24;
const MAX_DAILY_DAYS   = 30;

// ═════════════════════════════════════════════════════════════

export class PriceEngine {

	constructor(config) {
		this.config     = config;
		this.coinIds    = [config.baseToken.coingeckoId, config.quoteToken.coingeckoId];
		this.cmcSymbols = [config.baseToken.cmcSymbol, config.quoteToken.cmcSymbol];

		// Quick lookups: CG id → symbol, CMC symbol → symbol
		this.symByCgId = {
			[config.baseToken.coingeckoId]: config.baseToken.symbol,
			[config.quoteToken.coingeckoId]: config.quoteToken.symbol,
		};
		this.symByCmc = {
			[config.baseToken.cmcSymbol]: config.baseToken.symbol,
			[config.quoteToken.cmcSymbol]: config.quoteToken.symbol,
		};

		this.mode                  = 'normal';
		this.running               = false;
		this.violentSince          = null;
		this.lastVolatilityTrigger = null;
		this.timers                = {};
		this.lastDivAlertTime      = {};   // { symbol: epoch_ms }
		this.prevPrices            = {};   // { symbol: usd }
	}

	// ═════════════════════════════════════════════════════════
	//  Lifecycle
	// ═════════════════════════════════════════════════════════

	async start() {
		this.running = true;
		updatePriceEngineStatus({ running: true, mode: 'normal' });
		console.info('PRICE', `🔄 Starting engine — ${this.config.chainName} (${this.coinIds.join(', ')})`);

		// One-time: load 30-day daily candle history
		await this._fetchDailyHistory();

		// First intraday candles + price fetches
		await this._fetchCandles();
		await this._fetchCgPrices();
		await this._fetchCmcPrices();

		// Schedule recurring loops (self-managing setTimeout)
		this._scheduleCandles();
		this._scheduleCgPrices();
		this._scheduleCmcPrices();

		console.info('PRICE', '✅ Price engine running');
	}

	async stop() {
		this.running = false;
		for (const t of Object.values(this.timers)) clearTimeout(t);
		this.timers = {};
		updatePriceEngineStatus({ running: false });
		console.info('PRICE', '🛑 Price engine stopped');
	}

	/** One-off urgent refresh — callable from future strategies. */
	async urgentRefresh() {
		if (!this.running) return;
		console.info('PRICE', '⚡ Urgent refresh requested');
		await Promise.allSettled([this._fetchCgPrices(), this._fetchCmcPrices()]);
	}

	// ═════════════════════════════════════════════════════════
	//  Fetching
	// ═════════════════════════════════════════════════════════

	async _fetchDailyHistory() {
		for (const id of this.coinIds) {
			try {
				const raw = await getOhlcCandles(id, 30);
				if (!Array.isArray(raw)) continue;
				const candles = raw.map(c => ({ t: c[0], o: c[1], h: c[2], l: c[3], c: c[4] }));
				updateCandles(id, 'daily', candles.slice(-MAX_DAILY_DAYS));
				console.info('PRICE', `📅 ${this.symByCgId[id]}: loaded ${candles.length} daily candles`);
			} catch (err) {
				console.warn('PRICE', `Daily history failed (${id}): ${err.message}`);
			}
		}
	}

	async _fetchCandles() {
		for (const id of this.coinIds) {
			try {
				const raw = await getOhlcCandles(id, 1);
				if (!Array.isArray(raw)) continue;
				const candles = raw.map(c => ({ t: c[0], o: c[1], h: c[2], l: c[3], c: c[4] }));
				this._mergeCandles(id, candles);
			} catch (err) {
				console.warn('PRICE', `Candle fetch failed (${id}): ${err.message}`);
			}
		}
		updatePriceEngineStatus({ lastCandleFetch: new Date().toISOString() });
		this._checkVolatilityFromCandles();
	}

	async _fetchCgPrices() {
		try {
			const data = await getSimplePrices(this.coinIds);
			if (!data) return;
			for (const id of this.coinIds) {
				if (!data[id]?.usd) continue;
				const sym = this.symByCgId[id];
				updatePriceFeed(sym, 'cg', data[id].usd);
				this._checkPriceVolatility(sym, data[id].usd);
			}
			updatePriceEngineStatus({ lastCgPriceFetch: new Date().toISOString() });
			this._checkDivergence();
		} catch (err) {
			console.warn('PRICE', `CG price fetch failed: ${err.message}`);
		}
	}

	async _fetchCmcPrices() {
		try {
			const data = await getLatestPrices(this.cmcSymbols);
			if (!data) return;
			for (const cmc of this.cmcSymbols) {
				if (!data[cmc]?.usd) continue;
				const sym = this.symByCmc[cmc];
				updatePriceFeed(sym, 'cmc', data[cmc].usd);
			}
			updatePriceEngineStatus({ lastCmcPriceFetch: new Date().toISOString() });
			this._checkDivergence();
		} catch (err) {
			console.warn('PRICE', `CMC price fetch failed: ${err.message}`);
		}
	}

	// ═════════════════════════════════════════════════════════
	//  Scheduling (self-managing setTimeout loops)
	// ═════════════════════════════════════════════════════════

	_schedule(key, fetchFn) {
		clearTimeout(this.timers[key]);
		const ms = INTERVALS[this.mode][key];
		this.timers[key] = setTimeout(async () => {
			if (!this.running) return;
			await fetchFn();
			this._schedule(key, fetchFn);
		}, ms);
		updatePriceEngineStatus({ [`next_${key}`]: new Date(Date.now() + ms).toISOString() });
	}

	_scheduleCandles()   { this._schedule('candles',  () => this._fetchCandles()); }
	_scheduleCgPrices()  { this._schedule('cgPrice',  () => this._fetchCgPrices()); }
	_scheduleCmcPrices() { this._schedule('cmcPrice', () => this._fetchCmcPrices()); }

	_switchMode(next) {
		if (this.mode === next) return;
		const prev = this.mode;
		this.mode = next;
		this.violentSince = next === 'violent' ? new Date().toISOString() : null;
		if (next === 'normal') this.lastVolatilityTrigger = null;

		updatePriceEngineStatus({ mode: next, violentSince: this.violentSince });
		console.warn('PRICE', `⚠️  Mode: ${prev} → ${next}`);

		// Reschedule price loops only — candles never change interval
		this._scheduleCgPrices();
		this._scheduleCmcPrices();
	}

	// ═════════════════════════════════════════════════════════
	//  Candle Merging & Aggregation
	// ═════════════════════════════════════════════════════════

	_mergeCandles(coinId, incoming) {
		const { candles: cached } = getSteemDexBotData();
		const prev = cached[coinId] || { raw: [], hourly: [], daily: [] };

		// Merge & dedup raw candles by timestamp
		const map = new Map(prev.raw.map(c => [c.t, c]));
		for (const c of incoming) map.set(c.t, c);

		const cutoff = Date.now() - MAX_RAW_HOURS * 3_600_000;
		const raw = [...map.values()].filter(c => c.t >= cutoff).sort((a, b) => a.t - b.t);
		updateCandles(coinId, 'raw', raw);

		// Aggregate raw → hourly
		updateCandles(coinId, 'hourly', this._aggregate(raw, 3_600_000, MAX_HOURLY_HOURS * 3_600_000));

		// Update today's daily candle from raw data
		this._updateDailyCandle(coinId, raw);
	}

	/** Group candles into fixed-size buckets (e.g. 1h) and compute OHLC per bucket. */
	_aggregate(candles, bucketMs, maxAgeMs) {
		const groups = new Map();
		for (const c of candles) {
			const key = Math.floor(c.t / bucketMs) * bucketMs;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(c);
		}

		const out = [];
		for (const [t, g] of groups) {
			g.sort((a, b) => a.t - b.t);
			out.push({
				t,
				o: g[0].o,
				h: Math.max(...g.map(c => c.h)),
				l: Math.min(...g.map(c => c.l)),
				c: g[g.length - 1].c,
			});
		}
		const cutoff = Date.now() - maxAgeMs;
		return out.filter(c => c.t >= cutoff).sort((a, b) => a.t - b.t);
	}

	/** Maintain the current day's aggregated daily candle from today's raw data. */
	_updateDailyCandle(coinId, rawCandles) {
		const { candles: cached } = getSteemDexBotData();
		const daily = (cached[coinId]?.daily || []).slice();

		const todayStart = new Date();
		todayStart.setUTCHours(0, 0, 0, 0);
		const todayMs = todayStart.getTime();

		const todayRaw = rawCandles.filter(c => c.t >= todayMs);
		if (todayRaw.length === 0) {
			updateCandles(coinId, 'daily', daily.slice(-MAX_DAILY_DAYS));
			return;
		}

		todayRaw.sort((a, b) => a.t - b.t);
		const agg = {
			t: todayMs,
			o: todayRaw[0].o,
			h: Math.max(...todayRaw.map(c => c.h)),
			l: Math.min(...todayRaw.map(c => c.l)),
			c: todayRaw[todayRaw.length - 1].c,
		};

		const idx = daily.findIndex(c => c.t === todayMs);
		if (idx >= 0) daily[idx] = agg; else daily.push(agg);
		daily.sort((a, b) => a.t - b.t);
		updateCandles(coinId, 'daily', daily.slice(-MAX_DAILY_DAYS));
	}

	// ═════════════════════════════════════════════════════════
	//  Volatility Detection
	// ═════════════════════════════════════════════════════════

	_checkVolatilityFromCandles() {
		const { candles: cached } = getSteemDexBotData();
		let hit = false;

		for (const id of this.coinIds) {
			for (const c of (cached[id]?.raw || []).slice(-4)) {
				if (c.l > 0 && (c.h - c.l) / c.l > VOLATILITY_THRESHOLD) {
					hit = true;
					break;
				}
			}
			if (hit) break;
		}

		if (hit) {
			this.lastVolatilityTrigger = Date.now();
			if (this.mode !== 'violent') this._switchMode('violent');
		} else {
			this._maybeCalm();
		}
	}

	_checkPriceVolatility(symbol, price) {
		const prev = this.prevPrices[symbol];
		this.prevPrices[symbol] = price;
		if (!prev || prev === 0) return;

		const pct = Math.abs(price - prev) / prev;
		if (pct > VOLATILITY_THRESHOLD) {
			this.lastVolatilityTrigger = Date.now();
			if (this.mode !== 'violent') {
				console.warn('PRICE', `🔥 Volatile move ${symbol}: ${(pct * 100).toFixed(2)}%`);
				this._switchMode('violent');
			}
		} else {
			this._maybeCalm();
		}
	}

	_maybeCalm() {
		if (this.mode !== 'violent' || !this.lastVolatilityTrigger) return;
		if (Date.now() - this.lastVolatilityTrigger > VIOLENT_COOLDOWN_MS) {
			console.info('PRICE', '😌 Markets calm — back to normal');
			this._switchMode('normal');
		}
	}

	// ═════════════════════════════════════════════════════════
	//  Divergence Alerts
	// ═════════════════════════════════════════════════════════

	_checkDivergence() {
		const chatId = process.env.TELEGRAM_CHAT_ID;
		if (!chatId) return;

		const { priceFeeds } = getSteemDexBotData();

		for (const id of this.coinIds) {
			const sym  = this.symByCgId[id];
			const feed = priceFeeds[sym];
			if (!feed?.cg?.usd || !feed?.cmc?.usd) continue;

			const cg  = feed.cg.usd;
			const cmc = feed.cmc.usd;
			const mid = (cg + cmc) / 2;
			if (mid === 0) continue;

			const diff = Math.abs(cg - cmc) / mid;
			if (diff <= DIVERGENCE_THRESHOLD) continue;

			// Cooldown: skip if we alerted this coin recently
			const last = this.lastDivAlertTime[sym];
			if (last && Date.now() - last < DIVERGENCE_COOLDOWN_MS) continue;
			this.lastDivAlertTime[sym] = Date.now();

			const higher = cg > cmc ? 'CoinGecko' : 'CoinMarketCap';
			const trend  = this._pastTrend(id);

			const alert = {
				alert: 'PRICE_DIVERGENCE',
				coin: sym,
				differencePercent: +(diff * 100).toFixed(2),
				cgPrice: cg,
				cmcPrice: cmc,
				dexMidPrice: null,
				conclusion: `${higher} is ${(diff * 100).toFixed(2)}% higher. Possible data lag or market inefficiency.`,
				pastTrend: trend,
				timestamp: new Date().toISOString(),
			};

			addDivergenceAlert(alert);
			console.warn('ALERT', `🚨 Divergence ${sym}: ${alert.differencePercent}% gap`);

			const msg = `🚨 <b>PRICE DIVERGENCE — ${sym}</b>\n\n<code>${JSON.stringify(alert, null, 2)}</code>`;
			sendTelegramMessage(chatId, msg).catch(() => {});
		}
	}

	_pastTrend(coinId) {
		const { candles: cached } = getSteemDexBotData();
		const h = cached[coinId]?.hourly || [];
		if (h.length < 3) return 'Insufficient data';

		const last3 = h.slice(-3);
		const up   = last3.every((c, i) => i === 0 || c.c >= last3[i - 1].c);
		const down = last3.every((c, i) => i === 0 || c.c <= last3[i - 1].c);
		if (up)   return 'Uptrend (last 3h)';
		if (down) return 'Downtrend (last 3h)';
		return 'Sideways/Mixed (last 3h)';
	}
}
