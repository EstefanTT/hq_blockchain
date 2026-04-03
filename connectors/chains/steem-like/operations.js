// connectors/chains/steem-like/operations.js
// Order operations for Steem-like blockchains: place, cancel, query, balances, RC.
// Uses dsteem for transaction signing and broadcasting.

import dsteem from 'dsteem';

const { Client, PrivateKey, RCAPI } = dsteem;

/**
 * Format a number as a Steem-like asset string: "1.234 STEEM"
 * Always 3 decimal places as required by the protocol.
 */
export function formatAsset(amount, symbol) {
	return `${parseFloat(amount).toFixed(3)} ${symbol}`;
}

/**
 * Generate a unique-ish uint32 order ID from the current timestamp.
 * limit_order_create requires a uint32 orderid.
 */
export function generateOrderId() {
	return Date.now() % 4294967295; // 2^32 - 1
}

export class SteemLikeOperations {

	/**
	 * @param {Object} opts
	 * @param {string} opts.nodeUrl — RPC endpoint (e.g. 'https://api.steemit.com')
	 * @param {string} opts.chainName — 'steem', 'hive', 'blurt'
	 * @param {string} opts.account — blockchain account name
	 * @param {string} opts.activeKey — WIF private key (active authority)
	 * @param {string} opts.baseSymbol — e.g. 'STEEM'
	 * @param {string} opts.quoteSymbol — e.g. 'SBD'
	 */
	constructor({ nodeUrl, chainName, account, activeKey, baseSymbol, quoteSymbol }) {
		if (!nodeUrl) throw new Error('nodeUrl required for operations');
		if (!account) throw new Error('account required for operations');
		if (!activeKey) throw new Error('activeKey (WIF) required for operations');

		this.chainName = chainName || 'steem';
		this.account = account;
		this.baseSymbol = baseSymbol || 'STEEM';
		this.quoteSymbol = quoteSymbol || 'SBD';

		this._client = new Client(nodeUrl);
		this._key = PrivateKey.fromString(activeKey);
		this._rcApi = new RCAPI(this._client);
	}

	// ─── Place Limit Order ──────────────────────────────────────

	/**
	 * Place a limit order on the internal DEX.
	 *
	 * BUY  (buying base with quote): sell SBD, receive STEEM
	 * SELL (selling base for quote): sell STEEM, receive SBD
	 *
	 * @param {Object} opts
	 * @param {'buy'|'sell'} opts.side
	 * @param {number} opts.price — price in quote per base (SBD per STEEM)
	 * @param {number} opts.amount — amount of base token (STEEM)
	 * @param {number} [opts.expiration] — seconds until expiry (default: 28 days)
	 * @param {boolean} [opts.dryRun=false] — if true, build but don't broadcast
	 * @returns {{ orderId, operation, txId?, dryRun }}
	 */
	async placeLimitOrder({ side, price, amount, expiration = 28 * 24 * 3600, dryRun = false }) {
		if (side !== 'buy' && side !== 'sell') throw new Error(`Invalid side: ${side}`);
		if (!price || price <= 0) throw new Error(`Invalid price: ${price}`);
		if (!amount || amount <= 0) throw new Error(`Invalid amount: ${amount}`);

		const orderId = generateOrderId();
		const quoteAmount = amount * price;

		// BUY: sell quote (SBD) to receive base (STEEM)
		// SELL: sell base (STEEM) to receive quote (SBD)
		const amountToSell = side === 'buy'
			? formatAsset(quoteAmount, this.quoteSymbol)
			: formatAsset(amount, this.baseSymbol);

		const minToReceive = side === 'buy'
			? formatAsset(amount, this.baseSymbol)
			: formatAsset(quoteAmount, this.quoteSymbol);

		const expireDate = new Date(Date.now() + expiration * 1000);
		const expirationStr = expireDate.toISOString().replace(/\.\d{3}Z$/, '');

		const operation = ['limit_order_create', {
			owner: this.account,
			orderid: orderId,
			amount_to_sell: amountToSell,
			min_to_receive: minToReceive,
			fill_or_kill: false,
			expiration: expirationStr,
		}];

		if (dryRun) {
			console.info('TRADE', this.chainName.toUpperCase(),
				`[DRY-RUN] ${side.toUpperCase()} ${amount} ${this.baseSymbol} @ ${price} ${this.quoteSymbol} (orderid: ${orderId})`);
			return { orderId, operation, dryRun: true };
		}

		console.info('TRADE', this.chainName.toUpperCase(),
			`Placing ${side.toUpperCase()} ${amount} ${this.baseSymbol} @ ${price} ${this.quoteSymbol} (orderid: ${orderId})`);

		const result = await this._client.broadcast.sendOperations([operation], this._key);
		const txId = result?.id || result?.txId || null;

		console.info('TRADE', this.chainName.toUpperCase(),
			`✅ Order placed — txId: ${txId}, orderId: ${orderId}`);

		return { orderId, operation, txId, dryRun: false };
	}

	// ─── Cancel Order ───────────────────────────────────────────

	/**
	 * Cancel an open limit order.
	 * @param {number} orderId — the uint32 order ID
	 * @param {Object} [opts]
	 * @param {boolean} [opts.dryRun=false]
	 * @returns {{ orderId, operation, txId?, dryRun }}
	 */
	async cancelOrder(orderId, { dryRun = false } = {}) {
		if (orderId == null) throw new Error('orderId required');

		const operation = ['limit_order_cancel', {
			owner: this.account,
			orderid: orderId,
		}];

		if (dryRun) {
			console.info('TRADE', this.chainName.toUpperCase(),
				`[DRY-RUN] Cancel order ${orderId}`);
			return { orderId, operation, dryRun: true };
		}

		console.info('TRADE', this.chainName.toUpperCase(), `Cancelling order ${orderId}`);

		const result = await this._client.broadcast.sendOperations([operation], this._key);
		const txId = result?.id || result?.txId || null;

		console.info('TRADE', this.chainName.toUpperCase(),
			`✅ Order cancelled — txId: ${txId}, orderId: ${orderId}`);

		return { orderId, operation, txId, dryRun: false };
	}

	// ─── Get Open Orders ────────────────────────────────────────

	/**
	 * Fetch all open orders for this account.
	 * @returns {Array<{ orderId, side, price, amountBase, amountQuote, created, expiration }>}
	 */
	async getOpenOrders() {
		const raw = await this._client.call('condenser_api', 'get_open_orders', [this.account]);
		return normalizeOpenOrders(raw, this.baseSymbol, this.quoteSymbol);
	}

	// ─── Account Balances ───────────────────────────────────────

	/**
	 * Fetch native balances for this account.
	 * @returns {{ account, balance, quoteBalance, vestingShares, vestingDelegated, vestingReceived }}
	 */
	async getAccountBalances() {
		const accounts = await this._client.database.getAccounts([this.account]);
		if (!accounts?.length) throw new Error(`Account not found: ${this.account}`);
		const a = accounts[0];

		return {
			account: a.name,
			balance: a.balance,               // e.g. "549.822 STEEM"
			quoteBalance: a.sbd_balance,       // e.g. "3.410 SBD"
			vestingShares: a.vesting_shares,
			vestingDelegated: a.delegated_vesting_shares,
			vestingReceived: a.received_vesting_shares,
		};
	}

	// ─── Resource Credits / Bandwidth ───────────────────────────

	/**
	 * Get resource credit (RC) status for this account.
	 * Works on both Steem and Hive (uses RCAPI).
	 * @returns {{ percentage, currentMana, maxMana }}
	 */
	async getAccountRC() {
		const mana = await this._rcApi.getRCMana(this.account);
		return {
			percentage: mana.percentage / 100,  // convert from 0-10000 → 0-100
			currentMana: mana.current_mana,
			maxMana: mana.max_mana,
		};
	}
}

// ─── Normalizers ────────────────────────────────────────────

/**
 * Normalize raw open orders from condenser_api.get_open_orders.
 * Each order has: id, orderid, created, expiration, seller, for_sale, sell_price { base, quote }
 */
function normalizeOpenOrders(rawOrders, baseSymbol, quoteSymbol) {
	if (!Array.isArray(rawOrders)) return [];

	return rawOrders.map(o => {
		const sellPrice = o.sell_price;
		const base = parseAssetStr(sellPrice.base);
		const quote = parseAssetStr(sellPrice.quote);

		// Determine side: if the base of sell_price is quote currency (SBD), it's a BUY
		let side, price, amountBase, amountQuote;

		if (base.symbol === quoteSymbol) {
			// Selling SBD to get STEEM → BUY order
			side = 'buy';
			amountQuote = base.amount;
			amountBase = quote.amount;
			price = amountBase > 0 ? amountQuote / amountBase : 0;
		} else {
			// Selling STEEM to get SBD → SELL order
			side = 'sell';
			amountBase = base.amount;
			amountQuote = quote.amount;
			price = amountBase > 0 ? amountQuote / amountBase : 0;
		}

		return {
			orderId: o.orderid,
			side,
			price,
			amountBase,
			amountQuote,
			created: o.created,
			expiration: o.expiration,
		};
	});
}

function parseAssetStr(str) {
	const parts = str.trim().split(' ');
	return { amount: parseFloat(parts[0]), symbol: parts[1] };
}
