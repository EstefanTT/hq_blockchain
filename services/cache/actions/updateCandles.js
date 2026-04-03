// services/cache/actions/updateCandles.js
// Updates candle data for a specific coin and timeframe type (raw / hourly / daily).

export default function updateCandles(runtimeCache, coinCgId, type, candles) {
	if (!runtimeCache.candles[coinCgId]) {
		runtimeCache.candles[coinCgId] = { raw: [], hourly: [], daily: [] };
	}
	runtimeCache.candles[coinCgId][type] = candles;
}
