// api/routes/dashboard/steem-dex-bot.get.js
// GET /api/dashboard/steem-dex-bot — serves the STEEM DEX Bot dashboard page.
// No auth required (option c) — only the data endpoint is protected.

export default function handler(_req, res) {
	res.type('html').send(PAGE_HTML);
}

const PAGE_HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STEEM DEX Bot — Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
	body { font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
	.card { @apply bg-gray-800 rounded-lg p-4 border border-gray-700; }
	.fade-in { animation: fadeIn 0.3s ease-in; }
	@keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }
</style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">
<div class="max-w-5xl mx-auto p-4 sm:p-6">

	<!-- Header -->
	<div class="flex flex-wrap items-center justify-between mb-6 gap-3">
		<div class="flex items-center gap-3">
			<h1 class="text-xl sm:text-2xl font-bold">🤖 STEEM DEX Bot</h1>
			<span id="status-dot" class="w-3 h-3 rounded-full bg-gray-600 inline-block" title="Connection status"></span>
		</div>
		<div class="flex items-center gap-2">
			<input id="token" type="password" placeholder="API Token"
				class="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm w-44 focus:border-blue-500 focus:outline-none" />
			<button onclick="fetchData()"
				class="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm font-medium transition-colors">🔄</button>
		</div>
	</div>

	<!-- Engine Status -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">⚙️ Engine Status</h2>
		<div id="engine-info" class="text-gray-500 text-sm">Waiting for data…</div>
	</div>

	<!-- Prices -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
		<div class="card">
			<h2 class="text-base font-bold mb-2 text-gray-300">STEEM</h2>
			<div id="price-STEEM" class="text-gray-500 text-sm">—</div>
		</div>
		<div class="card">
			<h2 class="text-base font-bold mb-2 text-gray-300">SBD</h2>
			<div id="price-SBD" class="text-gray-500 text-sm">—</div>
		</div>
	</div>

	<!-- Order Book -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">📖 DEX Order Book — STEEM/SBD</h2>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<div class="text-green-500 text-xs font-bold mb-1">BIDS (Buy)</div>
				<table class="w-full text-sm">
					<thead><tr class="text-gray-500 border-b border-gray-700">
						<th class="text-right py-1 pr-2">Price (SBD)</th>
						<th class="text-right py-1">Amount (STEEM)</th>
					</tr></thead>
					<tbody id="bids-table"><tr><td colspan="2" class="text-gray-600 py-2">—</td></tr></tbody>
				</table>
			</div>
			<div>
				<div class="text-red-500 text-xs font-bold mb-1">ASKS (Sell)</div>
				<table class="w-full text-sm">
					<thead><tr class="text-gray-500 border-b border-gray-700">
						<th class="text-right py-1 pr-2">Price (SBD)</th>
						<th class="text-right py-1">Amount (STEEM)</th>
					</tr></thead>
					<tbody id="asks-table"><tr><td colspan="2" class="text-gray-600 py-2">—</td></tr></tbody>
				</table>
			</div>
		</div>
		<div id="book-meta" class="text-xs text-gray-500 mt-2">—</div>
	</div>

	<!-- Recent DEX Trades -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">🔄 Recent DEX Trades</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead><tr class="text-gray-500 border-b border-gray-700">
					<th class="text-left py-1">Time</th>
					<th class="text-right py-1 px-2">Type</th>
					<th class="text-right py-1 px-2">Price</th>
					<th class="text-right py-1">Amount</th>
				</tr></thead>
				<tbody id="trades-table"><tr><td colspan="4" class="text-gray-600 py-2">No trades yet</td></tr></tbody>
			</table>
		</div>
	</div>

	<!-- Candles -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">📊 Recent Candles — STEEM</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-gray-500 border-b border-gray-700">
						<th class="text-left py-1 pr-2">Time</th>
						<th class="text-right py-1 px-2">Open</th>
						<th class="text-right py-1 px-2">High</th>
						<th class="text-right py-1 px-2">Low</th>
						<th class="text-right py-1 pl-2">Close</th>
					</tr>
				</thead>
				<tbody id="candles-table">
					<tr><td colspan="5" class="text-gray-600 py-3">No candle data</td></tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- Alerts -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">🚨 Divergence Alerts</h2>
		<div id="alerts-list" class="text-gray-500 text-sm">None</div>
	</div>

	<!-- Storage Status -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">💾 Storage Status</h2>
		<div id="storage-info" class="text-gray-500 text-sm">Waiting for data…</div>
	</div>

	<!-- Account & Orders (Step 4) -->
	<div class="card mb-4">
		<h2 class="text-base font-bold mb-3 text-gray-300">👤 Account &amp; Orders</h2>
		<div id="account-info" class="text-gray-500 text-sm">Waiting for data…</div>
		<div id="open-orders" class="mt-3"></div>
	</div>

	<!-- Footer -->
	<p class="text-gray-600 text-xs mt-4 text-center">
		Auto-refresh 10 s · <span id="last-update">—</span>
	</p>
</div>

<script>
// ─── Token persistence ──────────────────────────────────────
const tokenEl = document.getElementById('token');
const stored = localStorage.getItem('hq_api_token');
if (stored) tokenEl.value = stored;
tokenEl.addEventListener('change', () => localStorage.setItem('hq_api_token', tokenEl.value));

// ─── Fetch ──────────────────────────────────────────────────
async function fetchData() {
	const token = tokenEl.value;
	if (!token) return;
	try {
		const res = await fetch('/api/dashboard/steem-prices', {
			headers: { 'X-API-Token': token },
		});
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const data = await res.json();
		render(data);
		dot('bg-green-500');
		document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
	} catch (e) {
		dot('bg-red-500');
		console.error(e);
	}
}

function dot(cls) {
	const el = document.getElementById('status-dot');
	el.className = 'w-3 h-3 rounded-full inline-block ' + cls;
}

// ─── Render ─────────────────────────────────────────────────
function render(d) {
	renderEngine(d.priceEngine || {});
	renderPrice('STEEM', d.priceFeeds?.STEEM);
	renderPrice('SBD',   d.priceFeeds?.SBD);
	renderOrderBook(d.orderBooks);
	renderTrades(d.recentTrades);
	renderCandles(d.candles);
	renderAlerts(d.divergenceAlerts);
	renderStorage(d.storageStats);
	renderAccount(d.accountData);
}

function renderEngine(e) {
	const mc = e.mode === 'violent' ? 'text-red-400' : 'text-green-400';
	const rc = e.running ? 'text-green-400' : 'text-red-400';
	const violent = e.violentSince
		? '<div class="mt-2 text-red-400 text-xs">⚠️ Violent since ' + new Date(e.violentSince).toLocaleTimeString() + '</div>'
		: '';
	document.getElementById('engine-info').innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">' +
			'<div>Running: <span class="' + rc + '">' + (e.running ? 'Yes ✅' : 'No ❌') + '</span></div>' +
			'<div>Mode: <span class="' + mc + '">' + ((e.mode || '—').toUpperCase()) + '</span></div>' +
			'<div>CG price: ' + tAgo(e.lastCgPriceFetch) + '</div>' +
			'<div>CMC price: ' + tAgo(e.lastCmcPriceFetch) + '</div>' +
			'<div>Next CG: ' + tUntil(e.next_cgPrice) + '</div>' +
			'<div>Next CMC: ' + tUntil(e.next_cmcPrice) + '</div>' +
			'<div>Candles: ' + tAgo(e.lastCandleFetch) + '</div>' +
			'<div>Next candles: ' + tUntil(e.next_candles) + '</div>' +
		'</div>' + violent;
}

function renderPrice(sym, feed) {
	const el = document.getElementById('price-' + sym);
	if (!feed || (!feed.cg && !feed.cmc)) { el.innerHTML = '<span class="text-gray-600">No data yet</span>'; return; }

	const cg  = feed.cg?.usd  != null ? '$' + feed.cg.usd.toFixed(4)  : '—';
	const cmc = feed.cmc?.usd != null ? '$' + feed.cmc.usd.toFixed(4) : '—';
	const dex = feed.dex?.usd != null ? '$' + feed.dex.usd.toFixed(4) : '—';

	let divHtml = '';
	if (feed.cg?.usd != null && feed.cmc?.usd != null) {
		const mid = (feed.cg.usd + feed.cmc.usd) / 2;
		const diff = mid > 0 ? Math.abs(feed.cg.usd - feed.cmc.usd) / mid * 100 : 0;
		const color = diff > 0.8 ? 'text-red-400' : 'text-green-400';
		divHtml = '<div class="mt-1">Δ CG↔CMC: <span class="' + color + '">' + diff.toFixed(2) + '%</span></div>';
	}

	el.innerHTML =
		'<div>CoinGecko: <span class="text-white font-medium">' + cg + '</span> <span class="text-gray-600 text-xs">' + tAgo(feed.cg?.updatedAt) + '</span></div>' +
		'<div>CMC: <span class="text-white font-medium">' + cmc + '</span> <span class="text-gray-600 text-xs">' + tAgo(feed.cmc?.updatedAt) + '</span></div>' +
		'<div>DEX Mid: <span class="text-white font-medium">' + dex + '</span> <span class="text-gray-600 text-xs">' + tAgo(feed.dex?.updatedAt) + '</span></div>' +
		divHtml;
}

function renderCandles(candles) {
	const tbody = document.getElementById('candles-table');
	const raw = candles?.steem?.raw || [];
	if (!raw.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-gray-600 py-3">No candle data</td></tr>'; return; }

	tbody.innerHTML = raw.slice(-10).reverse().map(function(c) {
		var chg = c.c >= c.o ? 'text-green-400' : 'text-red-400';
		return '<tr class="border-t border-gray-700/50">' +
			'<td class="py-1 pr-2 text-gray-400">' + new Date(c.t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + '</td>' +
			'<td class="text-right py-1 px-2">' + c.o.toFixed(4) + '</td>' +
			'<td class="text-right py-1 px-2 text-green-400">' + c.h.toFixed(4) + '</td>' +
			'<td class="text-right py-1 px-2 text-red-400">' + c.l.toFixed(4) + '</td>' +
			'<td class="text-right py-1 pl-2 ' + chg + '">' + c.c.toFixed(4) + '</td>' +
		'</tr>';
	}).join('');
}

function renderAlerts(alerts) {
	const el = document.getElementById('alerts-list');
	if (!alerts || !alerts.length) { el.innerHTML = '<span class="text-gray-600">No alerts</span>'; return; }

	el.innerHTML = alerts.slice(-10).reverse().map(function(a) {
		return '<div class="border-t border-gray-700/50 py-2">' +
			'<span class="text-gray-500 text-xs">' + new Date(a.timestamp).toLocaleString() + '</span>' +
			' <span class="text-yellow-400 ml-1">' + a.coin + '</span>' +
			' <span class="text-red-400 ml-1">' + a.differencePercent + '% gap</span>' +
			'<div class="text-xs text-gray-500 mt-0.5">' + esc(a.conclusion) + '</div>' +
		'</div>';
	}).join('');
}

function renderOrderBook(orderBooks) {
	var book = orderBooks?.['steem:STEEM/SBD'];
	var bids = document.getElementById('bids-table');
	var asks = document.getElementById('asks-table');
	var meta = document.getElementById('book-meta');

	if (!book || !book.bids) {
		bids.innerHTML = '<tr><td colspan="2" class="text-gray-600 py-2">Waiting\u2026</td></tr>';
		asks.innerHTML = '<tr><td colspan="2" class="text-gray-600 py-2">Waiting\u2026</td></tr>';
		meta.textContent = '\u2014';
		return;
	}

	bids.innerHTML = (book.bids || []).slice(0, 8).map(function(o) {
		return '<tr class="border-t border-gray-700/30">' +
			'<td class="text-right py-0.5 pr-2 text-green-400">' + o.price.toFixed(4) + '</td>' +
			'<td class="text-right py-0.5">' + o.amount.toFixed(3) + '</td></tr>';
	}).join('') || '<tr><td colspan="2" class="text-gray-600 py-2">\u2014</td></tr>';

	asks.innerHTML = (book.asks || []).slice(0, 8).map(function(o) {
		return '<tr class="border-t border-gray-700/30">' +
			'<td class="text-right py-0.5 pr-2 text-red-400">' + o.price.toFixed(4) + '</td>' +
			'<td class="text-right py-0.5">' + o.amount.toFixed(3) + '</td></tr>';
	}).join('') || '<tr><td colspan="2" class="text-gray-600 py-2">\u2014</td></tr>';

	meta.textContent = 'Mid: ' + (book.midPrice?.toFixed(4) || '\u2014') +
		' | Spread: ' + (book.spreadPercent?.toFixed(3) || '\u2014') + '%' +
		' | Updated: ' + tAgo(book.timestamp);
}

function renderTrades(recentTrades) {
	var trades = recentTrades?.['steem:STEEM/SBD'] || [];
	var tbody = document.getElementById('trades-table');
	if (!trades.length) {
		tbody.innerHTML = '<tr><td colspan="4" class="text-gray-600 py-2">No trades yet</td></tr>';
		return;
	}

	tbody.innerHTML = trades.slice(-10).reverse().map(function(t) {
		var color = t.type === 'buy' ? 'text-green-400' : 'text-red-400';
		return '<tr class="border-t border-gray-700/30">' +
			'<td class="py-0.5 text-gray-400">' + new Date(t.timestamp + 'Z').toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) + '</td>' +
			'<td class="text-right py-0.5 px-2 ' + color + '">' + t.type.toUpperCase() + '</td>' +
			'<td class="text-right py-0.5 px-2">' + t.price.toFixed(4) + '</td>' +
			'<td class="text-right py-0.5">' + t.amountBase.toFixed(3) + '</td></tr>';
	}).join('');
}

function renderStorage(s) {
	var el = document.getElementById('storage-info');
	if (!s) { el.innerHTML = '<span class="text-gray-600">No storage data</span>'; return; }

	var pos = s.currentPosition;
	var posHtml = pos
		? '<span class="text-white">' + (pos.baseBalance ?? 0).toFixed(3) + ' STEEM</span> / ' +
		  '<span class="text-white">' + (pos.quoteBalance ?? 0).toFixed(3) + ' SBD</span>' +
		  (pos.averageEntryPrice ? ' (avg: ' + pos.averageEntryPrice.toFixed(4) + ')' : '')
		: '<span class="text-gray-600">None</span>';

	el.innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">' +
			'<div>Last snapshot: ' + tAgo(s.lastSnapshotTime) + '</div>' +
			'<div>Snapshots today: <span class="text-white">' + (s.snapshotsToday ?? 0) + '</span></div>' +
			'<div>Trades logged today: <span class="text-white">' + (s.tradesToday ?? 0) + '</span></div>' +
			'<div>Position: ' + posHtml + '</div>' +
		'</div>';
}

// ─── Helpers ────────────────────────────────────────────────
function renderAccount(ad) {
	var el = document.getElementById('account-info');
	var ordersEl = document.getElementById('open-orders');
	if (!ad || !ad.account) {
		el.innerHTML = '<span class="text-gray-600">No account configured</span>';
		ordersEl.innerHTML = '';
		return;
	}

	var rcPct = ad.rc?.percentage ?? 0;
	var rcColor = rcPct > 50 ? 'text-green-400' : rcPct > 20 ? 'text-yellow-400' : 'text-red-400';

	el.innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">' +
			'<div>Account: <span class="text-white font-medium">@' + esc(ad.account) + '</span></div>' +
			'<div>STEEM: <span class="text-white font-medium">' + esc(ad.balance || '—') + '</span></div>' +
			'<div>SBD: <span class="text-white font-medium">' + esc(ad.quoteBalance || '—') + '</span></div>' +
			'<div>RC: <span class="' + rcColor + ' font-medium">' + (ad.rc ? rcPct.toFixed(1) + '%' : '—') + '</span></div>' +
			'<div>Open orders: <span class="text-white">' + (ad.openOrders?.length ?? 0) + '</span></div>' +
			'<div>Refreshed: ' + tAgo(ad.lastRefresh) + '</div>' +
		'</div>';

	// Open orders table
	var orders = ad.openOrders || [];
	if (!orders.length) {
		ordersEl.innerHTML = '<div class="text-xs text-gray-600 mt-2">No open orders</div>';
		return;
	}

	ordersEl.innerHTML =
		'<div class="text-xs font-bold text-gray-400 mb-1 mt-2">Open Orders</div>' +
		'<div class="overflow-x-auto">' +
		'<table class="w-full text-sm">' +
			'<thead><tr class="text-gray-500 border-b border-gray-700">' +
				'<th class="text-left py-1">ID</th>' +
				'<th class="text-right py-1 px-2">Side</th>' +
				'<th class="text-right py-1 px-2">Price (SBD)</th>' +
				'<th class="text-right py-1 px-2">Amount (STEEM)</th>' +
				'<th class="text-right py-1 px-2">Expires</th>' +
				'<th class="text-right py-1"></th>' +
			'</tr></thead>' +
			'<tbody>' + orders.map(function(o) {
				var color = o.side === 'buy' ? 'text-green-400' : 'text-red-400';
				return '<tr class="border-t border-gray-700/30">' +
					'<td class="py-0.5 text-gray-400">' + o.orderId + '</td>' +
					'<td class="text-right py-0.5 px-2 ' + color + '">' + o.side.toUpperCase() + '</td>' +
					'<td class="text-right py-0.5 px-2">' + o.price.toFixed(4) + '</td>' +
					'<td class="text-right py-0.5 px-2">' + o.amountBase.toFixed(3) + '</td>' +
					'<td class="text-right py-0.5 px-2 text-gray-500">' + new Date(o.expiration + 'Z').toLocaleDateString() + '</td>' +
					'<td class="text-right py-0.5">' +
						'<button onclick="cancelOrder(' + o.orderId + ')" ' +
							'class="text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 px-2 py-0.5 rounded transition-colors">' +
							'Cancel</button>' +
					'</td>' +
				'</tr>';
			}).join('') +
			'</tbody></table></div>';
}

async function cancelOrder(orderId) {
	if (!confirm('Cancel order #' + orderId + '?')) return;
	var token = document.getElementById('token').value;
	if (!token) { alert('Enter API token first'); return; }
	try {
		var res = await fetch('/api/execution/cancel-order', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-API-Token': token },
			body: JSON.stringify({ orderId: orderId }),
		});
		if (!res.ok) throw new Error('HTTP ' + res.status);
		var data = await res.json();
		alert(data.ok ? 'Order #' + orderId + ' cancelled' : 'Failed: ' + (data.error || 'unknown'));
		fetchData();
	} catch (e) {
		alert('Cancel failed: ' + e.message);
	}
}

function tAgo(iso) {
	if (!iso) return '—';
	var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 0) s = 0;
	if (s < 60)   return s + 's ago';
	if (s < 3600) return Math.floor(s / 60) + 'm ago';
	return Math.floor(s / 3600) + 'h ago';
}
function tUntil(iso) {
	if (!iso) return '—';
	var s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
	if (s <= 0) return 'now';
	if (s < 60)   return s + 's';
	if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
	return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}
function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ─── Auto-refresh ───────────────────────────────────────────
setInterval(fetchData, 10000);
if (tokenEl.value) setTimeout(fetchData, 500);
</script>
</body>
</html>`;
