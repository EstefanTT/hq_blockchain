// api/routes/dashboard/index.get.js
// GET /api/dashboard — Master Dashboard (home page).
// Contoso-inspired dark futuristic UI.

export default function handler(_req, res) {
	res.type('html').send(PAGE_HTML);
}

const PAGE_HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>hq_blockchain — Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
	body { font-family: 'Inter', -apple-system, sans-serif; }
	:root {
		--bg-main: #080d25;
		--bg-sidebar: #0c1230;
		--bg-card: #111936;
		--bg-card-hover: #151f45;
		--border: #1a2555;
		--text-muted: #6b7994;
		--accent: #4a8eff;
		--accent2: #7c4dff;
	}
	.sidebar { width: 230px; min-height: 100vh; }
	.main-content { margin-left: 230px; }
	.card {
		transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
		border: 1px solid var(--border);
		background: var(--bg-card);
	}
	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 30px rgba(0,0,0,0.3);
		border-color: rgba(74,142,255,0.2);
	}
	.toggle { position: relative; width: 48px; height: 26px; cursor: pointer; display: inline-block; }
	.toggle input { opacity: 0; width: 0; height: 0; }
	.toggle-track { position: absolute; inset: 0; border-radius: 13px; background: #2a3050; transition: background 0.25s; }
	.toggle input:checked + .toggle-track { background: #10b981; }
	.toggle-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.25s; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
	.toggle input:checked ~ .toggle-knob { transform: translateX(22px); }
	.toggle-sm { width: 40px; height: 22px; }
	.toggle-sm .toggle-knob { top: 2px; left: 2px; width: 18px; height: 18px; }
	.toggle-sm input:checked ~ .toggle-knob { transform: translateX(18px); }
	.status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
	.pulse { animation: pulse 2s infinite; }
	@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
	.fade-in { animation: fadeIn 0.4s ease-out; }
	@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
	.glow-blue { box-shadow: 0 0 20px rgba(74,142,255,0.15); }
	.nav-item { transition: all 0.15s; }
	.nav-active { background: rgba(74,142,255,0.15); color: #4a8eff; border-left: 3px solid #4a8eff; }
	.nav-inactive:hover { background: rgba(255,255,255,0.04); }
	.kpi-icon {
		width: 48px; height: 48px; border-radius: 14px;
		display: flex; align-items: center; justify-content: center;
		font-size: 22px;
	}
	.sev-INFO { color: #60a5fa; } .sev-WARN { color: #fbbf24; } .sev-ERROR { color: #f87171; } .sev-DEBUG { color: #a78bfa; }
	.no-data-msg { text-align: center; padding: 48px 16px; }
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
		<a href="/api/dashboard" class="nav-item nav-active flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium">
			<span>🏠</span><span class="nav-label">Home</span>
		</a>
		<a href="/api/dashboard/steem-dex-bot" class="nav-item nav-inactive flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7994] text-sm">
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
			<div>
				<h1 class="text-lg font-bold text-white">Dashboard</h1>
				<span id="last-update" class="text-[11px] text-[#6b7994]"></span>
			</div>
			<div class="flex items-center gap-4">
				<input id="token" type="password" placeholder="🔑 API Token"
					class="bg-[#111936] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs w-40 focus:border-[#4a8eff] focus:outline-none focus:ring-1 focus:ring-[#4a8eff]/30 placeholder-[#3a4260] transition-colors" />
				<label class="flex items-center gap-2">
					<label class="toggle" title="Global Dry-Run">
						<input id="chk-global-dryrun" type="checkbox" onchange="toggleGlobalDryRun(this.checked)" />
						<span class="toggle-track"></span>
						<span class="toggle-knob"></span>
					</label>
					<span class="text-xs text-[#6b7994]">Dry-Run</span>
					<span id="dryrun-badge" class="hidden px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded-full font-bold tracking-wide">DRY</span>
				</label>
				<button onclick="emergencyStop()"
					class="bg-red-600/90 hover:bg-red-500 px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-red-600/20 hover:shadow-red-500/30">
					🚨 <span>Emergency Stop</span>
				</button>
				<div class="w-8 h-8 rounded-full bg-gradient-to-br from-[#4a8eff] to-[#7c4dff] flex items-center justify-center text-xs font-bold shadow-md">U</div>
			</div>
		</div>
	</header>

	<!-- Page Content -->
	<main class="p-6 space-y-6 fade-in">

		<!-- Kill Switch Alert -->
		<div id="kill-alert" class="hidden bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-300 text-sm backdrop-blur-sm">
			<span class="font-bold">🚨 Kill Switch Active</span> — <span id="kill-reason"></span>
		</div>

		<!-- No Token Prompt -->
		<div id="no-token-msg" class="hidden card rounded-xl p-8 text-center">
			<div class="text-4xl mb-3">🔑</div>
			<div class="text-white font-semibold mb-1">Enter API Token</div>
			<div class="text-[#6b7994] text-sm">Enter your API token in the top-right field to load dashboard data.</div>
		</div>

		<!-- ─── App Overview Cards ──────────────────── -->
		<div id="main-content-area">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
				<div class="card rounded-xl p-5 relative overflow-hidden">
					<div class="flex justify-between items-start">
						<div>
							<div class="text-[11px] text-[#6b7994] mb-2 uppercase tracking-wider font-medium">App Size</div>
							<div id="stat-app-size" class="text-2xl font-bold text-white">—</div>
							<div id="stat-app-sub" class="text-xs text-[#6b7994] mt-1.5"></div>
						</div>
						<div class="kpi-icon bg-gradient-to-br from-blue-500/15 to-purple-500/15"><span>📦</span></div>
					</div>
				</div>
				<div class="card rounded-xl p-5 relative overflow-hidden">
					<div class="flex justify-between items-start">
						<div>
							<div class="text-[11px] text-[#6b7994] mb-2 uppercase tracking-wider font-medium">Logs Size</div>
							<div id="stat-logs" class="text-2xl font-bold text-white">—</div>
							<button id="btn-clean-logs" onclick="cleanLogs()" class="hidden text-[10px] bg-red-500/15 hover:bg-red-500/25 text-red-400 px-3 py-1 rounded-md mt-2 transition-colors font-medium">🗑️ Clean Logs</button>
						</div>
						<div class="kpi-icon bg-gradient-to-br from-amber-500/15 to-orange-500/15"><span>📋</span></div>
					</div>
				</div>
				<div class="card rounded-xl p-5 relative overflow-hidden">
					<div class="flex justify-between items-start">
						<div>
							<div class="text-[11px] text-[#6b7994] mb-2 uppercase tracking-wider font-medium">DB Size</div>
							<div id="stat-db" class="text-2xl font-bold text-white">—</div>
							<div id="stat-db-sub" class="text-xs text-[#6b7994] mt-1.5"></div>
						</div>
						<div class="kpi-icon bg-gradient-to-br from-emerald-500/15 to-cyan-500/15"><span>💾</span></div>
					</div>
				</div>
				<div class="card rounded-xl p-5 relative overflow-hidden">
					<div class="flex justify-between items-start">
						<div>
							<div class="text-[11px] text-[#6b7994] mb-2 uppercase tracking-wider font-medium">Last Snapshot</div>
							<div id="stat-snapshot" class="text-2xl font-bold text-white">—</div>
							<div id="stat-snapshots-sub" class="text-xs text-[#4a8eff] mt-1.5"></div>
						</div>
						<div class="kpi-icon bg-gradient-to-br from-violet-500/15 to-pink-500/15"><span>📸</span></div>
					</div>
				</div>
			</div>

			<!-- ─── Trading Bots ───────────────────────── -->
			<div class="mt-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest">Trading Bots</h2>
				</div>
				<div id="bot-cards" class="grid grid-cols-1 xl:grid-cols-2 gap-5"></div>
			</div>

			<!-- ─── System Overview ────────────────────── -->
			<div class="mt-6">
				<h2 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest mb-4">System Overview</h2>
				<div class="card rounded-xl p-6">
					<div id="system-info" class="text-sm text-[#6b7994]">Loading…</div>
				</div>
			</div>

			<!-- ─── Recent Logs ───────────────────────── -->
			<div class="mt-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-sm font-bold text-[#6b7994] uppercase tracking-widest">Recent Bot Logs</h2>
					<a href="/api/dashboard/logs" class="text-xs text-[#4a8eff] hover:text-blue-300 font-medium transition-colors">View Full Logs →</a>
				</div>
				<div class="card rounded-xl overflow-hidden">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-[#1a2555] text-[#6b7994] text-left">
								<th class="px-4 py-3 w-[140px] font-medium">Time</th>
								<th class="px-4 py-3 w-[70px] font-medium">Severity</th>
								<th class="px-4 py-3 w-[120px] font-medium">Event</th>
								<th class="px-4 py-3 font-medium">Message</th>
							</tr>
						</thead>
						<tbody id="log-body">
							<tr><td colspan="4" class="px-4 py-8 text-center text-[#3a4260]">Loading…</td></tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

	</main>
</div>

<script>
const API = '/api';
let data = null;

function token() { return document.getElementById('token').value.trim(); }

async function apiFetch(path, opts = {}) {
	const headers = { 'Content-Type': 'application/json' };
	const t = token();
	if (t) headers['X-API-Token'] = t;
	const resp = await fetch(API + path, { ...opts, headers });
	return resp.json();
}

// ─── Fetch & Render ───────────────────────

async function fetchData() {
	if (!token()) {
		document.getElementById('no-token-msg').classList.remove('hidden');
		document.getElementById('main-content-area').classList.add('hidden');
		return;
	}
	document.getElementById('no-token-msg').classList.add('hidden');
	document.getElementById('main-content-area').classList.remove('hidden');

	try {
		const r = await apiFetch('/dashboard/home-data');
		if (!r.ok) { console.error(r.error); return; }
		data = r;
		render(r);
	} catch (err) {
		console.error('Fetch failed:', err);
	}
}

function render(d) {
	document.getElementById('last-update').textContent = 'Updated ' + new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

	// Kill switch
	const killEl = document.getElementById('kill-alert');
	if (d.killSwitch.active) {
		killEl.classList.remove('hidden');
		document.getElementById('kill-reason').textContent = d.killSwitch.reason || 'Unknown';
	} else {
		killEl.classList.add('hidden');
	}

	// Global dry-run
	document.getElementById('chk-global-dryrun').checked = d.globalDryRun;
	const badge = document.getElementById('dryrun-badge');
	d.globalDryRun ? badge.classList.remove('hidden') : badge.classList.add('hidden');

	// ─── App Overview KPI Cards ───────
	const ai = d.overview.appSizeInfo || {};
	const ss = d.overview.storageStats || {};

	document.getElementById('stat-app-size').textContent = ai.appSizeMB ? ai.appSizeMB + ' MB' : '—';
	document.getElementById('stat-app-sub').textContent = ai.updatedAt ? 'Updated ' + timeSince(ai.updatedAt) + ' ago' : '';

	const logsMB = ai.logsSizeMB;
	document.getElementById('stat-logs').textContent = logsMB ? logsMB.toFixed(2) + ' MB' : '—';
	document.getElementById('btn-clean-logs').classList.toggle('hidden', !logsMB || logsMB < 0.01);

	const dbMB = ai.dbSizeMB;
	document.getElementById('stat-db').textContent = dbMB ? dbMB.toFixed(2) + ' MB' : '—';
	document.getElementById('stat-db-sub').textContent = (ss.tradesToday ?? 0) + ' trades today';

	const snapTime = ss.lastSnapshotTime;
	document.getElementById('stat-snapshot').textContent = snapTime ? new Date(snapTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
	document.getElementById('stat-snapshots-sub').textContent = (ss.snapshotsToday ?? 0) + ' today';

	// System info
	document.getElementById('system-info').innerHTML =
		'<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3">' +
		kpiSmall('Active Bots', d.bots.filter(b => b.enabled).length + ' / ' + d.bots.length) +
		kpiSmall('Trades Today', ss.tradesToday ?? '0') +
		kpiSmall('DB Size', dbMB ? dbMB.toFixed(2) + ' MB' : '—') +
		kpiSmall('Uptime', ai.updatedAt ? timeSince(ai.updatedAt) : '—') +
		'</div>';

	// Bot cards
	document.getElementById('bot-cards').innerHTML = d.bots.map(botCard).join('');

	// Recent logs
	renderLogs(d.recentLogs || []);
}

function botCard(b) {
	var on = b.enabled;
	var dataOn = b.dataCollection;
	var statusColor = on ? 'bg-emerald-500' : 'bg-gray-600';
	var statusGlow = on ? 'shadow-emerald-500/40 shadow-sm' : '';
	var statusText = on ? 'RUNNING' : 'STOPPED';
	var modeText = b.currentMode || 'idle';
	var disabledCount = b.disabledStrategies?.length || 0;

	var modeColors = {
		'market-making': 'bg-blue-500/20 text-blue-400',
		'aggressive-sniping': 'bg-orange-500/20 text-orange-400',
		'grid-range': 'bg-cyan-500/20 text-cyan-400',
		'mean-reversion': 'bg-purple-500/20 text-purple-400',
		'defensive': 'bg-red-500/20 text-red-400',
		'bot-exploitation': 'bg-yellow-500/20 text-yellow-400',
	};
	var modeClass = modeColors[modeText] || 'bg-gray-500/20 text-gray-400';

	var rc = b.accountData?.rc;
	var rcPct = rc?.percentage ?? rc?.percentageRemaining;
	var rcBar = rc && rcPct != null ? '<div class="mt-4"><div class="flex justify-between text-[10px] text-[#6b7994] mb-1"><span>Resource Credits</span><span class="text-white font-medium">' +
		rcPct.toFixed(0) + '%</span></div><div class="h-1.5 bg-[#0c1230] rounded-full overflow-hidden"><div class="h-full rounded-full transition-all duration-500 ' +
		(rcPct > 50 ? 'bg-emerald-500' : rcPct > 20 ? 'bg-yellow-500' : 'bg-red-500') +
		'" style="width:' + Math.min(rcPct, 100) + '%"></div></div></div>' : '';

	var priceHtml = '';
	if (b.priceEngine?.priceSources?.STEEM?.usd) {
		priceHtml = '<div class="text-xs text-[#6b7994] mt-2">STEEM: <span class="text-white font-semibold">$' +
			b.priceEngine.priceSources.STEEM.usd.toFixed(4) + '</span></div>';
	}

	var balHtml = '';
	if (b.accountData?.balance) {
		balHtml = '<div class="flex gap-4 mt-2 text-xs text-[#6b7994]">' +
			'<span>' + esc(b.accountData.balance) + '</span>' +
			'<span>' + esc(b.accountData.quoteBalance || '') + '</span>' +
		'</div>';
	}

	// Status badges
	var botBadge = on
		? '<span class="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] rounded font-bold">ON</span>'
		: '<span class="px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold">OFF</span>';
	var dataBadge = dataOn
		? '<span class="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] rounded font-bold">ON</span>'
		: '<span class="px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold">OFF</span>';

	return '<div class="card rounded-xl p-6">' +
		/* Header: icon + name + toggles */
		'<div class="flex items-center justify-between mb-4">' +
			'<div class="flex items-center gap-4">' +
				'<div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4a8eff]/20 to-[#7c4dff]/20 flex items-center justify-center text-2xl">🤖</div>' +
				'<div>' +
					'<div class="font-semibold text-white text-base">' + esc(b.label) + '</div>' +
					'<div class="text-[11px] text-[#6b7994]">' + esc(b.chain) + ' · ' + esc(b.pair) + '</div>' +
				'</div>' +
			'</div>' +
			'<div class="flex items-center gap-4">' +
				/* Data toggle */
				'<label class="flex items-center gap-1.5" title="Data Collection ON/OFF">' +
					'<label class="toggle toggle-sm">' +
						'<input type="checkbox" ' + (dataOn ? 'checked' : '') + ' onchange="toggleData(\\'' + b.name + '\\', this.checked)" />' +
						'<span class="toggle-track"></span>' +
						'<span class="toggle-knob"></span>' +
					'</label>' +
					'<span class="text-[10px] text-[#6b7994]">Data</span>' +
					dataBadge +
				'</label>' +
				/* Per-bot dry-run toggle */
				'<label class="flex items-center gap-1.5" title="Per-bot Dry-Run">' +
					'<label class="toggle toggle-sm">' +
						'<input type="checkbox" ' + (b.dryRun ? 'checked' : '') + ' onchange="toggleBotDryRun(\\'' + b.name + '\\', this.checked)" />' +
						'<span class="toggle-track"></span>' +
						'<span class="toggle-knob"></span>' +
					'</label>' +
					'<span class="text-[10px] text-[#6b7994]">Dry</span>' +
					(b.dryRun ? '<span class="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] rounded font-bold">DRY</span>' : '<span class="px-1.5 py-0.5 bg-[#1a2555] text-[#6b7994] text-[9px] rounded font-bold">LIVE</span>') +
				'</label>' +
				/* Bot ON/OFF */
				'<label class="flex items-center gap-1.5" title="Turn bot ON/OFF">' +
					'<label class="toggle">' +
						'<input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="toggleBot(\\'' + b.name + '\\', this.checked)" />' +
						'<span class="toggle-track"></span>' +
						'<span class="toggle-knob"></span>' +
					'</label>' +
					'<span class="text-[10px] text-[#6b7994]">Bot</span>' +
					botBadge +
				'</label>' +
			'</div>' +
		'</div>' +
		/* Status row */
		'<div class="flex items-center gap-3 flex-wrap">' +
			'<div class="flex items-center gap-2">' +
				'<span class="status-dot ' + statusColor + ' ' + statusGlow + '"></span>' +
				'<span class="text-xs font-semibold ' + (on ? 'text-emerald-400' : 'text-[#6b7994]') + '">' + statusText + '</span>' +
			'</div>' +
			'<span class="px-2.5 py-0.5 rounded-md text-[11px] font-semibold ' + modeClass + '">' + modeText.toUpperCase() + '</span>' +
			(disabledCount > 0 ? '<span class="text-[11px] text-yellow-400">(' + disabledCount + ' strat disabled)</span>' : '') +
		'</div>' +
		/* Data */
		priceHtml + balHtml + rcBar +
		/* Actions */
		'<div class="mt-5 pt-4 border-t border-[#1a2555]">' +
			'<a href="/api/dashboard/steem-dex-bot" class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4a8eff]/10 hover:bg-[#4a8eff]/20 text-[#4a8eff] text-xs font-semibold rounded-lg transition-colors">Open Detailed View <span>→</span></a>' +
		'</div>' +
	'</div>';
}

function renderLogs(logs) {
	var body = document.getElementById('log-body');
	if (!logs || !logs.length) {
		body.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-[#3a4260]">No logs yet</td></tr>';
		return;
	}
	body.innerHTML = logs.map(function(l) {
		var time = new Date(l.timestamp).toLocaleString(undefined, { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
		var sev = l.severity || 'INFO';
		return '<tr class="border-b border-[#1a2555]/50 hover:bg-[#151f45]/50 transition-colors">' +
			'<td class="px-4 py-3 text-[#6b7994] whitespace-nowrap">' + time + '</td>' +
			'<td class="px-4 py-3"><span class="sev-' + sev + ' font-semibold">' + sev + '</span></td>' +
			'<td class="px-4 py-3 text-[#6b7994]">' + esc(l.eventType || '') + '</td>' +
			'<td class="px-4 py-3 text-gray-200">' + esc(l.message || '') + '</td>' +
		'</tr>';
	}).join('');
}

function kpiSmall(label, value) {
	return '<div><div class="text-[11px] text-[#6b7994] uppercase tracking-wider mb-1 font-medium">' + label + '</div><div class="text-sm font-bold text-white">' + value + '</div></div>';
}

function timeSince(iso) {
	var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return s + 's';
	if (s < 3600) return Math.floor(s / 60) + 'm';
	return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}

function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ─── Actions ─────────────────────────────

async function toggleBot(name, enabled) {
	var r = await apiFetch('/execution/toggle-bot', {
		method: 'POST', body: JSON.stringify({ bot: name, enabled: enabled }),
	});
	if (!r.ok) alert('Error: ' + r.error);
	fetchData();
}

async function toggleData(name, enabled) {
	var r = await apiFetch('/execution/toggle-data', {
		method: 'POST', body: JSON.stringify({ bot: name, enabled: enabled }),
	});
	if (!r.ok) alert('Error: ' + r.error);
	fetchData();
}

async function toggleBotDryRun(name, enabled) {
	var r = await apiFetch('/execution/set-dry-run', {
		method: 'POST', body: JSON.stringify({ bot: name, enabled: enabled }),
	});
	if (!r.ok) alert('Error: ' + (r.error || 'unknown'));
	fetchData();
}

async function toggleGlobalDryRun(enabled) {
	await apiFetch('/execution/set-dry-run', {
		method: 'POST', body: JSON.stringify({ enabled: enabled }),
	});
	fetchData();
}

async function emergencyStop() {
	if (!confirm('🚨 Activate emergency stop? This will halt ALL trading and activate the kill switch.')) return;
	var r = await apiFetch('/execution/emergency-stop', { method: 'POST', body: '{}' });
	if (!r.ok) alert('Error: ' + r.error);
	fetchData();
}

async function cleanLogs() {
	if (!confirm('🗑️ Delete all log files? This cannot be undone.')) return;
	try {
		var r = await apiFetch('/execution/clean-logs', { method: 'POST', body: '{}' });
		if (r.ok) alert('Logs cleaned');
		else alert('Error: ' + (r.error || 'Not implemented yet'));
	} catch { alert('Clean logs endpoint not available yet'); }
	fetchData();
}

// ─── Init & Auto-refresh ─────────────────

// Load saved token FIRST, then fetch
var savedToken = localStorage.getItem('hq_api_token');
if (savedToken) document.getElementById('token').value = savedToken;
document.getElementById('token').addEventListener('change', function(e) {
	localStorage.setItem('hq_api_token', e.target.value);
	fetchData();
});

fetchData();
setInterval(fetchData, 10000);
</script>
</body>
</html>`;
