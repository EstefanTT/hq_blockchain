// api/routes/dashboard/steem-dex-bot.get.js
// GET /api/dashboard/steem-dex-bot — STEEM DEX Bot detailed page.
// Contoso-inspired dark futuristic UI with per-strategy control cards.

export default function handler(_req, res) {
	res.type('html').send(PAGE_HTML);
}

const PAGE_HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>hq_blockchain — STEEM DEX Bot</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
	body { font-family: 'Inter', -apple-system, sans-serif; }
	.sidebar { width: 230px; min-height: 100vh; }
	.main-content { margin-left: 230px; }
	.card { background: #111936; border: 1px solid #1a2555; transition: border-color 0.2s; }
	.card:hover { border-color: rgba(74,142,255,0.25); }
	.toggle { position: relative; width: 48px; height: 26px; cursor: pointer; display: inline-block; }
	.toggle input { opacity: 0; width: 0; height: 0; }
	.toggle-track { position: absolute; inset: 0; border-radius: 13px; background: #2a3050; transition: background 0.25s; }
	.toggle input:checked + .toggle-track { background: #10b981; }
	.toggle-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.25s; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
	.toggle input:checked ~ .toggle-knob { transform: translateX(22px); }
	.toggle-sm { width: 40px; height: 22px; }
	.toggle-sm .toggle-knob { top: 2px; left: 2px; width: 18px; height: 18px; }
	.toggle-sm input:checked ~ .toggle-knob { transform: translateX(18px); }
	.nav-item { transition: all 0.15s; }
	.nav-active { background: rgba(74,142,255,0.15); color: #4a8eff; border-left: 3px solid #4a8eff; }
	.nav-inactive:hover { background: rgba(255,255,255,0.04); }
	.fade-in { animation: fadeIn 0.3s ease-in; }
	@keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }
	.kpi-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
	.param-input {
		background: #0c1230; border: 1px solid #1a2555; border-radius: 8px;
		padding: 6px 10px; font-size: 12px; color: #e2e8f0; width: 100%;
		transition: border-color 0.15s;
	}
	.param-input:focus { border-color: #4a8eff; outline: none; box-shadow: 0 0 0 2px rgba(74,142,255,0.15); }
	.status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
	.sev-INFO { color: #60a5fa; } .sev-WARN { color: #fbbf24; } .sev-ERROR { color: #f87171; } .sev-DEBUG { color: #a78bfa; }
	.strategy-card { position: relative; overflow: hidden; }
	.strategy-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; border-radius: 4px 0 0 4px; }
	.strat-market-making::before { background: #3b82f6; }
	.strat-aggressive-sniping::before { background: #f97316; }
	.strat-grid-range::before { background: #06b6d4; }
	.strat-mean-reversion::before { background: #a855f7; }
	.strat-defensive::before { background: #6b7280; }
	.strat-bot-exploitation::before { background: #eab308; }
	@media (max-width: 768px) {
		.sidebar { width: 60px; }
		.sidebar .nav-label { display: none; }
		.main-content { margin-left: 60px; }
	}
</style>
</head>
<body class="bg-[#080d25] text-gray-100 min-h-screen">

<!-- ─── Sidebar ──────────────────────────────────────────── -->
<aside class="sidebar fixed top-0 left-0 bg-[#0c1230] border-r border-[#1a2555] flex flex-col z-50">
	<div class="px-5 py-5 border-b border-[#1a2555]">
		<div class="flex items-center gap-3">
			<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4a8eff] to-[#7c4dff] flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">H</div>
			<span class="nav-label text-sm font-semibold tracking-wide text-white">hq_blockchain</span>
		</div>
	</div>
	<nav class="flex-1 py-5 px-3 space-y-1">
		<a href="/api/dashboard" class="nav-item nav-inactive flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7994] text-sm">
			<span>🏠</span><span class="nav-label">Home</span>
		</a>
		<a href="/api/dashboard/steem-dex-bot" class="nav-item nav-active flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
			<span>🤖</span><span class="nav-label">STEEM DEX Bot</span>
		</a>
		<a href="/api/dashboard/logs" class="nav-item nav-inactive flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7994] text-sm">
			<span>📋</span><span class="nav-label">Logs Explorer</span>
		</a>
		<div class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#3a4260] text-sm cursor-not-allowed select-none">
			<span>🔬</span><span class="nav-label">Research</span>
		</div>
		<div class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#3a4260] text-sm cursor-not-allowed select-none">
			<span>⚙️</span><span class="nav-label">Settings</span>
		</div>
	</nav>
	<div class="px-5 py-4 border-t border-[#1a2555] text-[10px] text-[#3a4260]">
		<span class="nav-label">© 2025 hq_blockchain · v1.0</span>
	</div>
</aside>

<!-- ─── Main Content ─────────────────────────────────────── -->
<div class="main-content min-h-screen">

	<!-- Top Bar -->
	<header class="sticky top-0 z-40 bg-[#080d25]/95 backdrop-blur-md border-b border-[#1a2555] px-6 py-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<div>
					<h1 class="text-lg font-bold text-white">🤖 STEEM DEX Bot</h1>
					<span id="last-update" class="text-[11px] text-[#6b7994]"></span>
				</div>
				<span id="status-dot" class="status-dot bg-gray-600" title="Connection status"></span>
			</div>
			<div class="flex items-center gap-4">
				<input id="token" type="password" placeholder="🔑 API Token"
					class="bg-[#111936] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs w-40 focus:border-[#4a8eff] focus:outline-none focus:ring-1 focus:ring-[#4a8eff]/30 placeholder-[#3a4260] transition-colors" />
				<label class="flex items-center gap-2">
					<label class="toggle toggle-sm" title="Data Collection">
						<input id="chk-data" type="checkbox" onchange="toggleData(this.checked)" />
						<span class="toggle-track"></span>
						<span class="toggle-knob"></span>
					</label>
					<span class="text-xs text-[#6b7994]">Data</span>
					<span id="data-badge" class="hidden px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded-full font-bold">ON</span>
				</label>
				<label class="flex items-center gap-2">
					<label class="toggle" title="Dry-Run Mode">
						<input id="chk-dryrun" type="checkbox" onchange="toggleDryRun(this.checked)" />
						<span class="toggle-track"></span>
						<span class="toggle-knob"></span>
					</label>
					<span class="text-xs text-[#6b7994]">Dry-Run</span>
					<span id="dryrun-badge" class="hidden px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded-full font-bold">DRY</span>
				</label>
				<button onclick="emergencyPause()"
					class="bg-red-600/90 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-red-600/20">
					🚨 <span>Emergency Stop</span>
				</button>
			</div>
		</div>
	</header>

	<main class="p-6 space-y-6 fade-in">

		<!-- ─── Master Bot Switch ──────────────────── -->
		<div class="card rounded-xl p-5">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4a8eff]/20 to-[#7c4dff]/20 flex items-center justify-center text-2xl">🤖</div>
					<div>
						<div class="font-bold text-white text-lg">Bot Power</div>
						<div class="text-xs text-[#6b7994]">Steem · STEEM / SBD · <span id="bot-status-text" class="text-[#6b7994]">STOPPED</span> <span id="bot-mode-badge" class="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold"></span></div>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<select id="sel-mode" onchange="switchMode(this.value)" class="bg-[#0c1230] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs focus:border-[#4a8eff] focus:outline-none transition-colors">
						<option value="">— Switch Mode —</option>
						<option value="market-making">Market Making</option>
						<option value="aggressive-sniping">Aggressive Sniping</option>
						<option value="grid-range">Grid Range</option>
						<option value="mean-reversion">Mean Reversion</option>
						<option value="defensive">Defensive</option>
						<option value="bot-exploitation">Bot Exploitation</option>
					</select>
					<!-- Data toggle -->
					<label class="flex items-center gap-1.5" title="Data Collection ON/OFF">
						<label class="toggle toggle-sm">
							<input id="chk-data-power" type="checkbox" onchange="toggleData(this.checked)" />
							<span class="toggle-track"></span>
							<span class="toggle-knob"></span>
						</label>
						<span class="text-[10px] text-[#6b7994]">Data</span>
						<span id="data-power-badge" class="px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold">OFF</span>
					</label>
					<!-- Bot toggle -->
					<label class="flex items-center gap-1.5" title="Bot ON/OFF">
						<label class="toggle">
							<input id="chk-bot-power" type="checkbox" onchange="toggleBot(this.checked)" />
							<span class="toggle-track"></span>
							<span class="toggle-knob"></span>
						</label>
						<span class="text-[10px] text-[#6b7994]">Bot</span>
						<span id="bot-power-badge" class="px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold">OFF</span>
					</label>
				</div>
			</div>
		</div>

		<!-- No Token Prompt -->
		<div id="no-token-msg" class="hidden card rounded-xl p-8 text-center">
			<div class="text-4xl mb-3">🔑</div>
			<div class="text-white font-semibold mb-1">Enter API Token</div>
			<div class="text-[#6b7994] text-sm">Enter your API token in the top-right field to load bot data.</div>
		</div>

		<!-- ─── KPI Row ────────────────────────────── -->
		<div id="kpi-row" class="grid grid-cols-2 lg:grid-cols-5 gap-4">
			<div class="card rounded-xl p-4">
				<div class="text-[11px] text-[#6b7994] uppercase tracking-wider mb-1">STEEM Balance</div>
				<div id="kpi-steem" class="text-lg font-bold text-white">—</div>
			</div>
			<div class="card rounded-xl p-4">
				<div class="text-[11px] text-[#6b7994] uppercase tracking-wider mb-1">SBD Balance</div>
				<div id="kpi-sbd" class="text-lg font-bold text-white">—</div>
			</div>
			<div class="card rounded-xl p-4">
				<div class="text-[11px] text-[#6b7994] uppercase tracking-wider mb-1">RC</div>
				<div id="kpi-rc" class="text-lg font-bold text-white">—</div>
			</div>
			<div class="card rounded-xl p-4">
				<div class="text-[11px] text-[#6b7994] uppercase tracking-wider mb-1">Open Orders</div>
				<div id="kpi-orders" class="text-lg font-bold text-white">—</div>
			</div>
			<div class="card rounded-xl p-4">
				<div class="text-[11px] text-[#6b7994] uppercase tracking-wider mb-1">Micro Layer</div>
				<div id="kpi-micro" class="text-sm font-bold text-white">—</div>
			</div>
		</div>

		<!-- ─── Price & Engine ─────────────────────── -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<!-- Prices -->
			<div class="card rounded-xl p-5">
				<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">💰 Prices</h3>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<div class="text-xs text-[#6b7994] mb-1">STEEM</div>
						<div id="price-STEEM" class="text-sm text-gray-300">—</div>
					</div>
					<div>
						<div class="text-xs text-[#6b7994] mb-1">SBD</div>
						<div id="price-SBD" class="text-sm text-gray-300">—</div>
					</div>
				</div>
			</div>
			<!-- Engine -->
			<div class="card rounded-xl p-5">
				<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">⚙️ Engine Status</h3>
				<div id="engine-info" class="text-sm text-[#6b7994]">Waiting for data…</div>
			</div>
		</div>

		<!-- ─── Order Book & Trades ────────────────── -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<div class="card rounded-xl p-5">
				<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">📖 Order Book</h3>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<div class="text-emerald-400 text-[10px] font-bold mb-2 uppercase tracking-wider">Bids (Buy)</div>
						<table class="w-full text-xs">
							<thead><tr class="text-[#6b7994] border-b border-[#1a2555]"><th class="text-right py-1 pr-2">Price</th><th class="text-right py-1">Amount</th></tr></thead>
							<tbody id="bids-table"><tr><td colspan="2" class="text-[#3a4260] py-2">—</td></tr></tbody>
						</table>
					</div>
					<div>
						<div class="text-red-400 text-[10px] font-bold mb-2 uppercase tracking-wider">Asks (Sell)</div>
						<table class="w-full text-xs">
							<thead><tr class="text-[#6b7994] border-b border-[#1a2555]"><th class="text-right py-1 pr-2">Price</th><th class="text-right py-1">Amount</th></tr></thead>
							<tbody id="asks-table"><tr><td colspan="2" class="text-[#3a4260] py-2">—</td></tr></tbody>
						</table>
					</div>
				</div>
				<div id="book-meta" class="text-[10px] text-[#6b7994] mt-3 pt-2 border-t border-[#1a2555]">—</div>
			</div>
			<div class="card rounded-xl p-5">
				<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">🔄 Recent DEX Trades</h3>
				<table class="w-full text-xs">
					<thead><tr class="text-[#6b7994] border-b border-[#1a2555]"><th class="text-left py-1">Time</th><th class="text-right py-1 px-1">Type</th><th class="text-right py-1 px-1">Price</th><th class="text-right py-1">Amount</th></tr></thead>
					<tbody id="trades-table"><tr><td colspan="4" class="text-[#3a4260] py-2">No trades</td></tr></tbody>
				</table>
			</div>
		</div>

		<!-- ─── Brain Status ───────────────────────── -->
		<div class="card rounded-xl p-5">
			<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">🧠 Brain Status</h3>
			<div id="brain-status" class="text-sm text-[#6b7994]">Waiting for data…</div>
		</div>

		<!-- ─── Strategy Cards ─────────────────────── -->
		<div>
			<h2 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">📊 Strategy Control</h2>
			<div id="strategy-cards" class="space-y-5">
				<div class="text-sm text-[#3a4260]">Loading strategies…</div>
			</div>
		</div>

		<!-- ─── Micro Layer ────────────────────────── -->
		<div class="card rounded-xl p-5">
			<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">🔹 Micro Layer</h3>
			<div id="micro-layer" class="text-sm text-[#6b7994]">Waiting for data…</div>
		</div>

		<!-- ─── Risk & Exploitation ────────────────── -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
			<div class="card rounded-xl p-5">
				<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">🛡️ Risk Status</h3>
				<div id="risk-status" class="text-sm text-[#6b7994]">Waiting for data…</div>
			</div>
			<div class="card rounded-xl p-5">
				<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">🕵️ Bot Exploitation</h3>
				<div id="exploit-status" class="text-sm text-[#6b7994]">Waiting for data…</div>
			</div>
		</div>

		<!-- ─── Open Orders Table ──────────────────── -->
		<div class="card rounded-xl p-5">
			<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">📝 Open Orders</h3>
			<div id="open-orders" class="text-sm text-[#3a4260]">No orders</div>
		</div>

		<!-- ─── Recent Bot Logs ────────────────────── -->
		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest">📋 Recent Bot Logs</h2>
				<a href="/api/dashboard/logs" class="text-xs text-[#4a8eff] hover:text-blue-300 font-medium transition-colors">View Full Logs →</a>
			</div>
			<div class="card rounded-xl overflow-hidden">
				<div id="bot-logs" class="p-4 text-sm text-[#3a4260]">Waiting for data…</div>
			</div>
		</div>

		<!-- ─── Analysis Tools ─────────────────────── -->
		<div class="card rounded-xl p-5">
			<h3 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">🔬 Analysis Tools</h3>
			<p class="text-[#6b7994] text-xs mb-3">Run analysis scripts directly from the dashboard:</p>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
				<div class="bg-[#0c1230] rounded-lg p-3 flex items-center justify-between">
					<div>
						<span class="text-[#6b7994]">Daily summary</span>
						<code class="block text-emerald-400 mt-1 text-[11px]">npm run summary</code>
					</div>
					<button onclick="runAnalysis('summary', [])" class="ml-3 px-3 py-1.5 bg-[#4a8eff]/15 hover:bg-[#4a8eff]/25 text-[#4a8eff] text-xs font-medium rounded-lg transition-colors whitespace-nowrap">▶ Run</button>
				</div>
				<div class="bg-[#0c1230] rounded-lg p-3 flex items-center justify-between">
					<div>
						<span class="text-[#6b7994]">Log analysis (7d)</span>
						<code class="block text-emerald-400 mt-1 text-[11px]">npm run analyze -- --days 7</code>
					</div>
					<button onclick="runAnalysis('analyze', ['--days', '7'])" class="ml-3 px-3 py-1.5 bg-[#4a8eff]/15 hover:bg-[#4a8eff]/25 text-[#4a8eff] text-xs font-medium rounded-lg transition-colors whitespace-nowrap">▶ Run</button>
				</div>
				<div class="bg-[#0c1230] rounded-lg p-3 flex items-center justify-between">
					<div>
						<span class="text-[#6b7994]">Backtest market-making</span>
						<code class="block text-emerald-400 mt-1 text-[11px]">npm run backtest -- --strategy market-making --days 30</code>
					</div>
					<button onclick="runAnalysis('backtest', ['--strategy', 'market-making', '--days', '30'])" class="ml-3 px-3 py-1.5 bg-[#4a8eff]/15 hover:bg-[#4a8eff]/25 text-[#4a8eff] text-xs font-medium rounded-lg transition-colors whitespace-nowrap">▶ Run</button>
				</div>
				<div class="bg-[#0c1230] rounded-lg p-3 flex items-center justify-between">
					<div>
						<span class="text-[#6b7994]">Backtest grid-range + CSV</span>
						<code class="block text-emerald-400 mt-1 text-[11px]">npm run backtest -- --strategy grid-range --csv</code>
					</div>
					<button onclick="runAnalysis('backtest', ['--strategy', 'grid-range', '--csv'])" class="ml-3 px-3 py-1.5 bg-[#4a8eff]/15 hover:bg-[#4a8eff]/25 text-[#4a8eff] text-xs font-medium rounded-lg transition-colors whitespace-nowrap">▶ Run</button>
				</div>
			</div>
			<div id="analysis-output" class="hidden mt-4 bg-[#0c1230] rounded-lg p-4 text-xs font-mono text-gray-300 max-h-60 overflow-auto whitespace-pre-wrap"></div>
		</div>

		<!-- Footer -->
		<div class="text-center text-[#3a4260] text-[11px] py-2">
			Auto-refresh 10s · <span id="footer-time">—</span>
			<span id="app-size" class="ml-3"></span>
		</div>
	</main>
</div>

<script>
// ─── Strategy definitions ────────────────────────────────────
const STRATEGIES = [
	{
		key: 'market-making', configKey: 'marketMaking',
		label: 'Market Making', icon: '📈', color: '#3b82f6',
		desc: 'Places buy and sell limit orders around the mid price to capture the spread.',
		params: [
			{ key: 'spreadPercent', label: 'Spread %', type: 'number', step: 0.01 },
			{ key: 'orderSizeQuote', label: 'Order Size (SBD)', type: 'number', step: 0.1 },
			{ key: 'refreshIntervalMs', label: 'Refresh Interval (ms)', type: 'number', step: 1000 },
			{ key: 'orderExpirationSec', label: 'Expiration (sec)', type: 'number', step: 10 },
			{ key: 'maxTotalExposureQuote', label: 'Max Exposure (SBD)', type: 'number', step: 1 },
		],
	},
	{
		key: 'aggressive-sniping', configKey: 'aggressiveSniping',
		label: 'Aggressive Sniping', icon: '🎯', color: '#f97316',
		desc: 'Targets mispriced orders with fast, aggressive fills when opportunities appear.',
		params: [
			{ key: 'maxSizeQuote', label: 'Max Size (SBD)', type: 'number', step: 0.5 },
			{ key: 'targetSlippagePercent', label: 'Target Slippage %', type: 'number', step: 0.01 },
			{ key: 'maxDurationSeconds', label: 'Max Duration (sec)', type: 'number', step: 5 },
			{ key: 'orderExpirationSec', label: 'Expiration (sec)', type: 'number', step: 10 },
		],
	},
	{
		key: 'grid-range', configKey: 'gridRange',
		label: 'Grid / Range', icon: '📊', color: '#06b6d4',
		desc: 'Places a grid of orders across a detected price range to accumulate fills.',
		params: [
			{ key: 'minRangeWidthPercent', label: 'Min Range Width %', type: 'number', step: 0.1 },
			{ key: 'baseSizeQuote', label: 'Base Size (SBD)', type: 'number', step: 0.1 },
			{ key: 'maxLevels', label: 'Max Levels', type: 'number', step: 1 },
			{ key: 'refreshSeconds', label: 'Refresh (sec)', type: 'number', step: 5 },
			{ key: 'lookbackMinutes', label: 'Lookback (min)', type: 'number', step: 5 },
			{ key: 'orderExpirationSec', label: 'Expiration (sec)', type: 'number', step: 10 },
		],
	},
	{
		key: 'mean-reversion', configKey: 'meanReversion',
		label: 'Mean Reversion', icon: '🔄', color: '#a855f7',
		desc: 'Bets on price snapping back after a sharp move away from the mean.',
		params: [
			{ key: 'triggerMovePercent', label: 'Trigger Move %', type: 'number', step: 0.1 },
			{ key: 'targetSnapbackPercent', label: 'Snapback Target %', type: 'number', step: 0.1 },
			{ key: 'maxDurationSeconds', label: 'Max Duration (sec)', type: 'number', step: 5 },
			{ key: 'baseSizeQuote', label: 'Base Size (SBD)', type: 'number', step: 0.1 },
			{ key: 'lookbackMinutes', label: 'Lookback (min)', type: 'number', step: 5 },
			{ key: 'orderExpirationSec', label: 'Expiration (sec)', type: 'number', step: 10 },
		],
	},
	{
		key: 'defensive', configKey: 'defensivePause',
		label: 'Defensive / Pause', icon: '🛡️', color: '#6b7280',
		desc: 'Pauses trading when conditions are unfavorable (thin book, low RC, high volatility).',
		params: [
			{ key: 'thinBookThreshold', label: 'Thin Book Threshold', type: 'number', step: 50 },
			{ key: 'minRCPercent', label: 'Min RC %', type: 'number', step: 1 },
		],
	},
	{
		key: 'bot-exploitation', configKey: 'botExploitation',
		label: 'Bot Exploitation', icon: '🕵️', color: '#eab308',
		desc: 'Detects and exploits predictable bot behavior patterns in the order book.',
		params: [
			{ key: 'baitDistancePercent', label: 'Bait Distance %', type: 'number', step: 0.001 },
			{ key: 'pushSizeQuote', label: 'Push Size (SBD)', type: 'number', step: 1 },
			{ key: 'maxCycles', label: 'Max Cycles', type: 'number', step: 1 },
			{ key: 'cycleCooldownMs', label: 'Cycle Cooldown (ms)', type: 'number', step: 500 },
			{ key: 'maxDurationSeconds', label: 'Max Duration (sec)', type: 'number', step: 5 },
			{ key: 'orderExpirationSec', label: 'Expiration (sec)', type: 'number', step: 5 },
		],
	},
];

// ─── State ───────────────────────────────────────────────────
let currentData = null;
let effectiveConfig = {};
let controlState = {};

const tokenEl = document.getElementById('token');
const saved = localStorage.getItem('hq_api_token');
if (saved) tokenEl.value = saved;
tokenEl.addEventListener('change', () => { localStorage.setItem('hq_api_token', tokenEl.value); fetchData(); });

function token() { return tokenEl.value.trim(); }

async function apiFetch(path, opts = {}) {
	const headers = { 'Content-Type': 'application/json' };
	const t = token();
	if (t) headers['X-API-Token'] = t;
	const resp = await fetch('/api' + path, { ...opts, headers });
	return resp.json();
}

// ─── Fetch & Render ──────────────────────────────────────────

async function fetchData() {
	if (!token()) {
		document.getElementById('no-token-msg').classList.remove('hidden');
		return;
	}
	document.getElementById('no-token-msg').classList.add('hidden');
	try {
		const d = await apiFetch('/dashboard/steem-prices');
		currentData = d;
		effectiveConfig = d.effectiveConfig || {};
		controlState = d.botControlState || {};
		render(d);
		dot('bg-emerald-500');
		document.getElementById('last-update').textContent = 'Last Data Reload: ' + new Date().toLocaleString();
		document.getElementById('footer-time').textContent = new Date().toLocaleTimeString();
	} catch (e) {
		dot('bg-red-500');
		console.error(e);
	}
}

function dot(cls) {
	document.getElementById('status-dot').className = 'status-dot ' + cls;
}

function render(d) {
	renderBotSwitch(d);
	renderDataState(d);
	renderKPIs(d);
	renderPrices(d);
	renderEngine(d.priceEngine || {});
	renderOrderBook(d.orderBooks);
	renderTrades(d.recentTrades);
	renderBrain(d.brainStatus);
	renderStrategyCards(d);
	renderMicroLayer(d.microLayerStatus);
	renderRisk(d.riskStatus);
	renderExploit(d.exploitationStatus);
	renderOpenOrders(d.accountData);
	renderBotLogs(d.recentBotLogs);
	renderAppSize(d.appSizeInfo);
	renderDryRunState(d.dryRunEnabled);
}

// ─── Render functions ────────────────────────────────────────

function renderBotSwitch(d) {
	const on = d.botEnabled;
	document.getElementById('chk-bot-power').checked = !!on;
	const st = document.getElementById('bot-status-text');
	st.textContent = on ? 'RUNNING' : 'STOPPED';
	st.className = on ? 'text-emerald-400 font-medium' : 'text-[#6b7994]';
	// Bot power badge
	var botBadge = document.getElementById('bot-power-badge');
	if (on) { botBadge.textContent = 'ON'; botBadge.className = 'px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold'; }
	else { botBadge.textContent = 'OFF'; botBadge.className = 'px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold'; }
	// Brain mode badge in Bot Power section
	var mode = d.brainStatus?.currentMode || 'idle';
	var modeColors = { 'market-making':'bg-blue-500/20 text-blue-400','aggressive-sniping':'bg-orange-500/20 text-orange-400','grid-range':'bg-cyan-500/20 text-cyan-400','mean-reversion':'bg-purple-500/20 text-purple-400','defensive':'bg-red-500/20 text-red-400','bot-exploitation':'bg-yellow-500/20 text-yellow-400' };
	var badge = document.getElementById('bot-mode-badge');
	badge.className = 'ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold ' + (modeColors[mode] || 'bg-gray-500/20 text-gray-400');
	badge.textContent = mode.toUpperCase();
}

function renderDataState(d) {
	var dataOn = d.dataCollectionEnabled;
	// Top bar data toggle + badge
	document.getElementById('chk-data').checked = !!dataOn;
	var topBadge = document.getElementById('data-badge');
	if (dataOn) { topBadge.textContent = 'ON'; topBadge.className = 'px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded-full font-bold'; }
	else { topBadge.textContent = 'OFF'; topBadge.className = 'px-2 py-0.5 bg-[#1a2555] text-[#6b7994] text-[10px] rounded-full font-bold'; }
	// Bot Power section data toggle + badge
	document.getElementById('chk-data-power').checked = !!dataOn;
	var powerBadge = document.getElementById('data-power-badge');
	if (dataOn) { powerBadge.textContent = 'ON'; powerBadge.className = 'px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] rounded font-bold'; }
	else { powerBadge.textContent = 'OFF'; powerBadge.className = 'px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold'; }
}

function renderKPIs(d) {
	document.getElementById('kpi-steem').textContent = d.accountData?.balance || '—';
	document.getElementById('kpi-sbd').textContent = d.accountData?.quoteBalance || '—';
	document.getElementById('kpi-orders').textContent = d.accountData?.openOrders?.length ?? '—';
	const rcPct = d.accountData?.rc?.percentage ?? d.accountData?.rc?.percentageRemaining;
	if (rcPct != null) {
		const rcColor = rcPct > 50 ? 'text-emerald-400' : rcPct > 20 ? 'text-yellow-400' : 'text-red-400';
		document.getElementById('kpi-rc').innerHTML = '<span class="' + rcColor + '">' + rcPct.toFixed(1) + '%</span>';
	}
	// Micro Layer summary in KPI row
	var ml = d.microLayerStatus;
	var microEl = document.getElementById('kpi-micro');
	if (ml) {
		var lockStr = (ml.totalValueQuote ?? 0).toFixed(1) + ' SBD';
		var fillStr = ml.lastFillTime ? tAgo(ml.lastFillTime) : '—';
		microEl.innerHTML = '<span class="' + (ml.active ? 'text-emerald-400' : 'text-[#6b7994]') + '">' + (ml.active ? 'ON' : 'OFF') + '</span>' +
			'<div class="text-[10px] text-[#6b7994] mt-1 font-normal">Locked: ' + lockStr + '</div>' +
			'<div class="text-[10px] text-[#6b7994] font-normal">Fill: ' + fillStr + '</div>';
	} else {
		microEl.textContent = '—';
	}
}

function renderPrices(d) {
	['STEEM', 'SBD'].forEach(function(sym) {
		var el = document.getElementById('price-' + sym);
		var feed = d.priceFeeds?.[sym];
		if (!feed) { el.innerHTML = '<span class="text-[#3a4260]">No data</span>'; return; }
		var cg = feed.cg?.usd != null ? '$' + feed.cg.usd.toFixed(4) : '—';
		var cmc = feed.cmc?.usd != null ? '$' + feed.cmc.usd.toFixed(4) : '—';
		var dex = feed.dex?.usd != null ? '$' + feed.dex.usd.toFixed(4) : '—';
		el.innerHTML =
			'<div class="space-y-0.5">' +
			'<div>CG: <span class="text-white font-medium">' + cg + '</span></div>' +
			'<div>CMC: <span class="text-white font-medium">' + cmc + '</span></div>' +
			'<div>DEX: <span class="text-white font-medium">' + dex + '</span></div>' +
			'</div>';
	});
}

function renderEngine(e) {
	var rc = e.running ? 'text-emerald-400' : 'text-red-400';
	document.getElementById('engine-info').innerHTML =
		'<div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">' +
		'<div>Running: <span class="' + rc + ' font-medium">' + (e.running ? 'Yes' : 'No') + '</span></div>' +
		'<div>Mode: <span class="text-white">' + ((e.mode || '—').toUpperCase()) + '</span></div>' +
		'<div>CG price: ' + tAgo(e.lastCgPriceFetch) + '</div>' +
		'<div>CMC price: ' + tAgo(e.lastCmcPriceFetch) + '</div>' +
		'</div>';
}

function renderBrain(br) {
	var el = document.getElementById('brain-status');
	if (!br) { el.innerHTML = '<span class="text-[#3a4260]">No brain data</span>'; return; }
	var modeColors = { 'market-making':'text-blue-400','aggressive-sniping':'text-orange-400','grid-range':'text-cyan-400','mean-reversion':'text-purple-400','defensive':'text-red-400','bot-exploitation':'text-yellow-400' };
	var mc = modeColors[br.currentMode] || 'text-gray-400';
	var sigHtml = '';
	var s = br.signals || {};
	if (s.midPrice != null) {
		sigHtml = '<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs text-[#6b7994] mt-3 pt-3 border-t border-[#1a2555]">' +
			'<div>Imbalance: <span class="text-white">' + (s.imbalanceRatio || 0) + '×</span></div>' +
			'<div>Velocity: <span class="text-white">' + (s.tradeVelocity ?? 0) + '</span></div>' +
			'<div>Divergence: <span class="' + ((s.maxDivergencePercent||0) > 1.5 ? 'text-yellow-400' : 'text-white') + '">' + (s.maxDivergencePercent ?? 0) + '%</span></div>' +
			'<div>RC: <span class="' + ((s.rcPercent||0) < 30 ? 'text-red-400' : 'text-emerald-400') + '">' + (s.rcPercent ?? 0) + '%</span></div>' +
		'</div>';
	}
	el.innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">' +
		'<div>Active: <span class="' + (br.active ? 'text-emerald-400' : 'text-[#6b7994]') + ' font-medium">' + (br.active ? 'Yes':'No') + '</span></div>' +
		'<div>Mode: <span class="' + mc + ' font-medium">' + esc(br.currentMode || 'none').toUpperCase() + '</span></div>' +
		'<div>Last switch: ' + (br.lastSwitchTime ? tAgo(br.lastSwitchTime) : '—') + '</div>' +
		'<div>Next tick: ' + (br.nextTickTime ? tUntil(br.nextTickTime) : '—') + '</div>' +
		'</div>' +
		(br.lastSwitchReason ? '<div class="text-xs text-[#6b7994] mt-2">💬 ' + esc(br.lastSwitchReason) + '</div>' : '') +
		sigHtml;
}

// ─── Strategy Cards ──────────────────────────────────────────

function renderStrategyCards(d) {
	var container = document.getElementById('strategy-cards');
	var disabledList = controlState.disabledStrategies || [];
	var activeMode = d.brainStatus?.currentMode;

	container.innerHTML = STRATEGIES.map(function(s) {
		var isDisabled = disabledList.includes(s.key);
		var isActive = activeMode === s.key;
		var cfg = effectiveConfig[s.configKey] || {};

		var statusBadge = isActive
			? '<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-full font-bold uppercase tracking-wider">ON</span>'
			: '<span class="px-2 py-0.5 bg-[#1a2555] text-[#6b7994] text-[10px] rounded-full font-medium">OFF</span>';

		var paramsHtml = s.params.map(function(p) {
			var val = cfg[p.key] ?? '';
			return '<div class="flex items-center gap-2">' +
				'<label class="text-[11px] text-[#6b7994] w-36 flex-shrink-0">' + p.label + '</label>' +
				'<input type="' + p.type + '" step="' + (p.step||1) + '" value="' + val + '" ' +
					'data-strat="' + s.configKey + '" data-param="' + p.key + '" ' +
					'class="param-input flex-1 max-w-[140px]" />' +
			'</div>';
		}).join('');

		// Live data
		var liveHtml = '';
		if (isActive) {
			var st = d.strategyStatus || {};
			liveHtml = '<div class="mt-3 pt-3 border-t border-[#1a2555] grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px]">' +
				'<div class="text-[#6b7994]">Orders: <span class="text-white">' + ((st.buyOrders||0) + (st.sellOrders||0)) + '</span></div>' +
				'<div class="text-[#6b7994]">Locked: <span class="text-white">' + (st.totalValueQuote ?? 0).toFixed(2) + ' SBD</span></div>' +
				'<div class="text-[#6b7994]">Last fill: <span class="text-white">' + (st.lastFillTime ? tAgo(st.lastFillTime) : '—') + '</span></div>' +
				'<div class="text-[#6b7994]">Mid: <span class="text-white">' + (st.lastMidPrice ? st.lastMidPrice.toFixed(4) : '—') + '</span></div>' +
			'</div>';
		}

		return '<div class="card strategy-card strat-' + s.key + ' rounded-xl p-5">' +
			'<div class="flex items-center justify-between mb-3">' +
				'<div class="flex items-center gap-3">' +
					'<span class="text-xl">' + s.icon + '</span>' +
					'<div>' +
						'<div class="font-semibold text-white">' + s.label + '</div>' +
						'<div class="text-[11px] text-[#6b7994] mt-0.5 max-w-md">' + s.desc + '</div>' +
					'</div>' +
				'</div>' +
				'<div class="flex items-center gap-3">' +
					statusBadge +
					'<label class="toggle toggle-sm" title="Enable/Disable ' + s.label + '">' +
						'<input type="checkbox" ' + (!isDisabled ? 'checked' : '') + ' onchange="toggleStrategy(\\'' + s.key + '\\', this.checked)" />' +
						'<span class="toggle-track"></span>' +
						'<span class="toggle-knob"></span>' +
					'</label>' +
				'</div>' +
			'</div>' +
			'<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">' + paramsHtml + '</div>' +
			'<div class="mt-3 flex items-center gap-2">' +
				'<button onclick="saveParams(\\'' + s.configKey + '\\')" class="bg-[#4a8eff]/15 hover:bg-[#4a8eff]/25 text-[#4a8eff] text-xs font-medium px-4 py-1.5 rounded-lg transition-colors">Save Parameters</button>' +
				'<span id="save-status-' + s.configKey + '" class="text-[10px] text-emerald-400 hidden">✓ Saved</span>' +
			'</div>' +
			liveHtml +
		'</div>';
	}).join('');
}

// ─── Other render functions ──────────────────────────────────

function renderOrderBook(orderBooks) {
	var book = orderBooks?.['steem:STEEM/SBD'];
	var bids = document.getElementById('bids-table');
	var asks = document.getElementById('asks-table');
	var meta = document.getElementById('book-meta');
	if (!book || !book.bids) {
		bids.innerHTML = asks.innerHTML = '<tr><td colspan="2" class="text-[#3a4260] py-2">Waiting…</td></tr>';
		meta.textContent = '—'; return;
	}
	bids.innerHTML = (book.bids||[]).slice(0,8).map(function(o) {
		return '<tr class="border-t border-[#1a2555]/50"><td class="text-right py-0.5 pr-2 text-emerald-400">' + o.price.toFixed(4) + '</td><td class="text-right py-0.5 text-gray-300">' + o.amount.toFixed(3) + '</td></tr>';
	}).join('') || '<tr><td colspan="2" class="text-[#3a4260] py-2">—</td></tr>';
	asks.innerHTML = (book.asks||[]).slice(0,8).map(function(o) {
		return '<tr class="border-t border-[#1a2555]/50"><td class="text-right py-0.5 pr-2 text-red-400">' + o.price.toFixed(4) + '</td><td class="text-right py-0.5 text-gray-300">' + o.amount.toFixed(3) + '</td></tr>';
	}).join('') || '<tr><td colspan="2" class="text-[#3a4260] py-2">—</td></tr>';
	meta.textContent = 'Mid: ' + (book.midPrice?.toFixed(4)|| '—') + ' | Spread: ' + (book.spreadPercent?.toFixed(3)||'—') + '% | ' + tAgo(book.timestamp);
}

function renderTrades(recentTrades) {
	var trades = recentTrades?.['steem:STEEM/SBD'] || [];
	var tbody = document.getElementById('trades-table');
	if (!trades.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-[#3a4260] py-2">No trades</td></tr>'; return; }
	tbody.innerHTML = trades.slice(-10).reverse().map(function(t) {
		var c = t.type === 'buy' ? 'text-emerald-400' : 'text-red-400';
		return '<tr class="border-t border-[#1a2555]/50"><td class="py-0.5 text-[#6b7994]">' + new Date(t.timestamp+'Z').toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + '</td><td class="text-right py-0.5 px-1 ' + c + '">' + t.type.toUpperCase() + '</td><td class="text-right py-0.5 px-1 text-gray-300">' + t.price.toFixed(4) + '</td><td class="text-right py-0.5 text-gray-300">' + t.amountBase.toFixed(3) + '</td></tr>';
	}).join('');
}

function renderMicroLayer(ml) {
	var el = document.getElementById('micro-layer');
	if (!ml) { el.innerHTML = '<span class="text-[#3a4260]">No data</span>'; return; }
	var total = (ml.buyOrders||0)+(ml.sellOrders||0);
	el.innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">' +
		'<div>Active: <span class="' + (ml.active?'text-emerald-400':'text-[#6b7994]') + ' font-medium">' + (ml.active?'Yes':'No') + '</span></div>' +
		'<div>Orders: <span class="text-white">' + total + '</span> <span class="text-[#6b7994]">(' + (ml.buyOrders||0) + 'B/' + (ml.sellOrders||0) + 'S)</span></div>' +
		'<div>Locked: <span class="text-white">' + (ml.totalValueQuote??0).toFixed(2) + ' SBD</span></div>' +
		'<div>Last fill: ' + (ml.lastFillTime?tAgo(ml.lastFillTime):'—') + '</div>' +
		'</div>' +
		(ml.lastMidPrice ? '<div class="text-[10px] text-[#6b7994] mt-1">Grid mid: ' + ml.lastMidPrice.toFixed(4) + ' · Levels: ' + (ml.levelsConfigured||0) + '</div>' : '');
}

function renderRisk(r) {
	var el = document.getElementById('risk-status');
	if (!r) { el.innerHTML = '<span class="text-[#3a4260]">No data</span>'; return; }
	el.innerHTML =
		'<div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">' +
		'<div>Slippage rejects: <span class="text-yellow-400 font-medium">' + (r.slippageRejectCount||0) + '</span></div>' +
		'<div>Last reject: ' + (r.lastSlippageReject?tAgo(r.lastSlippageReject):'—') + '</div>' +
		'</div>' +
		(r.lastRebalanceTime ? '<div class="text-[10px] text-[#6b7994] mt-1">Last rebalance: ' + r.lastRebalanceSide + ' ' + (r.lastRebalanceAmount||0) + ' @ ' + (r.lastRebalancePrice||0) + ' (' + tAgo(r.lastRebalanceTime) + ')</div>' : '');
}

function renderExploit(ex) {
	var el = document.getElementById('exploit-status');
	if (!ex) { el.innerHTML = '<span class="text-[#3a4260]">No data</span>'; return; }
	el.innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs">' +
		'<div>Active: <span class="' + (ex.active?'text-emerald-400':'text-[#6b7994]') + '">' + (ex.active?'Yes':'No') + '</span></div>' +
		'<div>Cycles: <span class="text-white">' + (ex.cycleCount||0) + '</span></div>' +
		'<div>Phase: <span class="text-cyan-400">' + esc(ex.phase||'idle') + '</span></div>' +
		'</div>' +
		(ex.lastAction ? '<div class="text-[10px] text-[#6b7994] mt-1">' + esc(ex.lastAction) + '</div>' : '');
}

function renderOpenOrders(ad) {
	var el = document.getElementById('open-orders');
	var orders = ad?.openOrders || [];
	if (!orders.length) { el.innerHTML = '<span class="text-[#3a4260] text-xs">No open orders</span>'; return; }
	el.innerHTML =
		'<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-[#6b7994] border-b border-[#1a2555]">' +
		'<th class="text-left py-1">ID</th><th class="text-right py-1 px-2">Side</th><th class="text-right py-1 px-2">Price</th><th class="text-right py-1 px-2">Amount</th><th class="text-right py-1 px-2">Expires</th><th class="py-1"></th>' +
		'</tr></thead><tbody>' +
		orders.map(function(o) {
			var c = o.side==='buy'?'text-emerald-400':'text-red-400';
			return '<tr class="border-t border-[#1a2555]/50">' +
				'<td class="py-1 text-[#6b7994]">' + o.orderId + '</td>' +
				'<td class="text-right py-1 px-2 ' + c + '">' + o.side.toUpperCase() + '</td>' +
				'<td class="text-right py-1 px-2 text-gray-300">' + o.price.toFixed(4) + '</td>' +
				'<td class="text-right py-1 px-2 text-gray-300">' + o.amountBase.toFixed(3) + '</td>' +
				'<td class="text-right py-1 px-2 text-[#6b7994]">' + new Date(o.expiration+'Z').toLocaleDateString() + '</td>' +
				'<td class="text-right py-1"><button onclick="cancelOrder(' + o.orderId + ')" class="text-[10px] bg-red-500/15 hover:bg-red-500/25 text-red-400 px-2 py-0.5 rounded transition-colors">Cancel</button></td></tr>';
		}).join('') +
		'</tbody></table></div>';
}

function renderBotLogs(logs) {
	var el = document.getElementById('bot-logs');
	if (!logs||!logs.length) { el.innerHTML = '<span class="text-[#3a4260] text-xs">No logs</span>'; return; }
	var sevColors = { INFO:'text-blue-400', WARN:'text-yellow-400', ERROR:'text-red-400', DEBUG:'text-purple-400' };
	el.innerHTML = logs.map(function(l) {
		var ts = new Date(l.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
		var sev = l.severity||'INFO';
		return '<div class="border-t border-[#1a2555]/50 py-1.5 text-xs first:border-0">' +
			'<span class="text-[#6b7994]">' + ts + '</span> ' +
			'<span class="' + (sevColors[sev]||'text-gray-400') + ' font-medium">' + sev + '</span> ' +
			'<span class="text-[#6b7994]">[' + esc(l.eventType||'') + ']</span> ' +
			'<span class="text-gray-300">' + esc(l.message||'') + '</span>' +
		'</div>';
	}).join('');
}

function renderAppSize(info) {
	var el = document.getElementById('app-size');
	if (!info) { el.textContent = ''; return; }
	el.textContent = 'App: ' + (info.appSizeMB||'?') + ' MB | Logs: ' + (info.logsSizeMB||'?') + ' MB';
}

function renderDryRunState(enabled) {
	document.getElementById('chk-dryrun').checked = !!enabled;
	var b = document.getElementById('dryrun-badge');
	if (enabled) { b.textContent = 'DRY'; b.className = 'px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded-full font-bold'; }
	else { b.textContent = 'LIVE'; b.className = 'px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-full font-bold'; }
}

// ─── Actions ─────────────────────────────────────────────────

async function toggleBot(enabled) {
	var r = await apiFetch('/execution/toggle-bot', { method: 'POST', body: JSON.stringify({ bot: 'steem-dex-bot', enabled: enabled }) });
	if (!r.ok) alert('Error: ' + r.error);
	fetchData();
}

async function toggleData(enabled) {
	var r = await apiFetch('/execution/toggle-data', { method: 'POST', body: JSON.stringify({ bot: 'steem-dex-bot', enabled: enabled }) });
	if (!r.ok) alert('Error: ' + r.error);
	fetchData();
}

async function runAnalysis(script, args) {
	var outEl = document.getElementById('analysis-output');
	outEl.classList.remove('hidden');
	outEl.textContent = 'Running ' + script + '…';
	try {
		var r = await apiFetch('/execution/run-analysis', { method: 'POST', body: JSON.stringify({ script: script, args: args }) });
		outEl.textContent = r.ok ? r.output : ('Error: ' + (r.error || 'unknown'));
	} catch (err) {
		outEl.textContent = 'Error: ' + err.message;
	}
}

async function toggleStrategy(strategy, enabled) {
	var r = await apiFetch('/execution/toggle-strategy', { method: 'POST', body: JSON.stringify({ bot: 'steem-dex-bot', strategy: strategy, enabled: enabled }) });
	if (!r.ok) alert('Error: ' + r.error);
	fetchData();
}

async function saveParams(configKey) {
	var inputs = document.querySelectorAll('input[data-strat="' + configKey + '"]');
	var params = {};
	inputs.forEach(function(inp) {
		var v = inp.value;
		params[inp.dataset.param] = inp.type === 'number' ? parseFloat(v) : v;
	});
	var r = await apiFetch('/execution/update-params', {
		method: 'POST',
		body: JSON.stringify({ bot: 'steem-dex-bot', section: configKey, params: params }),
	});
	var statusEl = document.getElementById('save-status-' + configKey);
	if (r.ok) {
		statusEl.classList.remove('hidden');
		statusEl.textContent = '✓ Saved';
		setTimeout(function() { statusEl.classList.add('hidden'); }, 3000);
	} else {
		alert('Error: ' + (r.error || 'unknown'));
	}
	fetchData();
}

async function toggleDryRun(enabled) {
	if (!token()) { alert('Enter API token first'); return; }
	await apiFetch('/execution/set-dry-run', { method: 'POST', body: JSON.stringify({ enabled: enabled }) });
	fetchData();
}

async function emergencyPause() {
	if (!confirm('🚨 Emergency Stop — halt all trading?')) return;
	if (!token()) { alert('Enter API token first'); return; }
	var r = await apiFetch('/execution/emergency-stop', { method: 'POST', body: '{}' });
	if (!r.ok) alert('Error: ' + (r.error||'unknown'));
	fetchData();
}

async function switchMode(mode) {
	if (!mode) return;
	if (!token()) { alert('Enter API token first'); document.getElementById('sel-mode').value=''; return; }
	var r = await apiFetch('/execution/switch-mode', { method: 'POST', body: JSON.stringify({ mode: mode }) });
	if (!r.ok) alert('Error: ' + (r.error||'unknown'));
	document.getElementById('sel-mode').value = '';
	fetchData();
}

async function cancelOrder(orderId) {
	if (!confirm('Cancel order #' + orderId + '?')) return;
	if (!token()) { alert('Enter API token first'); return; }
	var r = await apiFetch('/execution/cancel-order', { method: 'POST', body: JSON.stringify({ orderId: orderId }) });
	if (r.ok) alert('Order #' + orderId + ' cancelled');
	else alert('Failed: ' + (r.error||'unknown'));
	fetchData();
}

// ─── Helpers ─────────────────────────────────────────────────
function tAgo(iso) {
	if (!iso) return '—';
	var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 0) s = 0;
	if (s < 60) return s + 's ago';
	if (s < 3600) return Math.floor(s/60) + 'm ago';
	return Math.floor(s/3600) + 'h ago';
}
function tUntil(iso) {
	if (!iso) return '—';
	var s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
	if (s <= 0) return 'now';
	if (s < 60) return s + 's';
	if (s < 3600) return Math.floor(s/60) + 'm ' + (s%60) + 's';
	return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
}
function esc(s) { var d = document.createElement('div'); d.textContent = s||''; return d.innerHTML; }

// ─── Auto-refresh ────────────────────────────────────────────
setInterval(fetchData, 10000);
if (tokenEl.value) setTimeout(fetchData, 500);
</script>
</body>
</html>`;
