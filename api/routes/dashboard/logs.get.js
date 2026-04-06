// api/routes/dashboard/logs.get.js
// GET /api/dashboard/logs — Logs Explorer page (HTML).
// Contoso-inspired dark futuristic UI.

import { renderSidebar } from './shared/sidebar.js';

export default function handler(_req, res) {
	res.type('html').send(PAGE_HTML.replace('<!--SIDEBAR-->', renderSidebar('logs')));
}

const PAGE_HTML = /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>hq_blockchain — Logs Explorer</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
	body { font-family: 'Inter', -apple-system, sans-serif; }
	.sidebar { width: 230px; min-height: 100vh; }
	.main-content { margin-left: 230px; }
	.card { background: #111936; border: 1px solid #1a2555; }
	.toggle { position: relative; width: 48px; height: 26px; cursor: pointer; display: inline-block; }
	.toggle input { opacity: 0; width: 0; height: 0; }
	.toggle-track { position: absolute; inset: 0; border-radius: 13px; background: #2a3050; transition: background 0.25s; }
	.toggle input:checked + .toggle-track { background: #10b981; }
	.toggle-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.25s; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
	.toggle input:checked ~ .toggle-knob { transform: translateX(22px); }
	.nav-item { transition: all 0.15s; }
	.nav-active { background: rgba(74,142,255,0.15); color: #4a8eff; border-left: 3px solid #4a8eff; }
	.nav-inactive:hover { background: rgba(255,255,255,0.04); }
	.sev-INFO { color: #60a5fa; } .sev-WARN { color: #fbbf24; } .sev-ERROR { color: #f87171; } .sev-DEBUG { color: #a78bfa; }
	.log-row { transition: background 0.1s; }
	.log-row:hover { background: rgba(74,142,255,0.05); }
	.log-data { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
	.fade-in { animation: fadeIn 0.3s ease-in; }
	@keyframes fadeIn { from { opacity: 0.5; } to { opacity: 1; } }
	@media (max-width: 768px) {
		.sidebar { width: 60px; }
		.sidebar .nav-label { display: none; }
		.main-content { margin-left: 60px; }
	}
</style>
</head>
<body class="bg-[#080d25] text-gray-100 min-h-screen">

<!-- ─── Sidebar ──────────────────────────────────────────── -->
<!--SIDEBAR-->

<!-- ─── Main Content ─────────────────────────────────────── -->
<div class="main-content min-h-screen">

	<!-- Top Bar -->
	<header class="sticky top-0 z-40 bg-[#080d25]/95 backdrop-blur-md border-b border-[#1a2555] px-6 py-3">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-lg font-bold text-white">📋 Logs Explorer</h1>
				<span id="log-count" class="text-[11px] text-[#6b7994]"></span>
			</div>
			<input id="token" type="password" placeholder="🔑 API Token"
				class="bg-[#111936] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs w-40 focus:border-[#4a8eff] focus:outline-none focus:ring-1 focus:ring-[#4a8eff]/30 placeholder-[#3a4260] transition-colors" />
		</div>
	</header>

	<main class="p-6 fade-in">

		<!-- Filters -->
		<div class="card rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-2 text-xs text-[#6b7994] font-medium"><span>🔍</span> Filter</div>
			<select id="fil-event" class="bg-[#0c1230] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs focus:border-[#4a8eff] focus:outline-none transition-colors">
				<option value="">All Events</option>
			</select>
			<select id="fil-severity" class="bg-[#0c1230] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs focus:border-[#4a8eff] focus:outline-none transition-colors">
				<option value="">All Severity</option>
				<option value="DEBUG">DEBUG</option>
				<option value="INFO">INFO</option>
				<option value="WARN">WARN</option>
				<option value="ERROR">ERROR</option>
			</select>
			<input id="fil-search" type="text" placeholder="Search messages…"
				class="bg-[#0c1230] border border-[#1a2555] rounded-lg px-3 py-1.5 text-xs w-56 focus:border-[#4a8eff] focus:outline-none transition-colors placeholder-[#3a4260]" />
			<button onclick="resetFilters()" class="text-xs text-[#6b7994] hover:text-gray-300 transition-colors px-2">Reset</button>
			<button onclick="loadLogs(true)" class="bg-[#4a8eff] hover:bg-[#3a7eef] px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-colors shadow-md shadow-blue-500/20">Apply</button>
		</div>

		<!-- Log Table -->
		<div class="card rounded-xl overflow-hidden">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-[#1a2555] text-[#6b7994] text-left">
						<th class="px-4 py-3 w-[140px] font-medium">Time</th>
						<th class="px-4 py-3 w-[75px] font-medium">Severity</th>
						<th class="px-4 py-3 w-[120px] font-medium">Event</th>
						<th class="px-4 py-3 w-[90px] font-medium">Strategy</th>
						<th class="px-4 py-3 font-medium">Message</th>
					</tr>
				</thead>
				<tbody id="log-body">
					<tr><td colspan="5" class="px-4 py-8 text-center text-[#3a4260]">Loading…</td></tr>
				</tbody>
			</table>
		</div>

		<!-- Load More -->
		<div class="flex justify-center mt-5">
			<button id="btn-more" onclick="loadMore()" class="hidden bg-[#111936] hover:bg-[#151f45] border border-[#1a2555] px-8 py-2.5 rounded-xl text-xs font-medium transition-all hover:border-[#4a8eff]/30">
				Load 50 more
			</button>
		</div>

	</main>
</div>

<script>
const API = '/api';
let allLogs = [];
let nextBeforeId = null;
let hasMore = false;

function token() { return document.getElementById('token').value.trim(); }

async function apiFetch(path) {
	const headers = {};
	const t = token();
	if (t) headers['X-API-Token'] = t;
	const resp = await fetch(API + path, { headers });
	return resp.json();
}

function getFilters() {
	return {
		eventType: document.getElementById('fil-event').value,
		severity: document.getElementById('fil-severity').value,
		search: document.getElementById('fil-search').value.trim(),
	};
}

async function loadLogs(reset = true) {
	if (reset) { allLogs = []; nextBeforeId = null; }
	const f = getFilters();
	let url = '/dashboard/logs-data?limit=50';
	if (nextBeforeId) url += '&beforeId=' + nextBeforeId;
	if (f.eventType) url += '&eventType=' + encodeURIComponent(f.eventType);
	if (f.severity) url += '&severity=' + encodeURIComponent(f.severity);
	if (f.search) url += '&search=' + encodeURIComponent(f.search);

	const r = await apiFetch(url);
	if (!r.ok) { console.error(r.error); return; }

	allLogs = reset ? r.logs : [...allLogs, ...r.logs];
	hasMore = r.hasMore;
	nextBeforeId = r.nextBeforeId;

	if (reset && r.eventTypes) {
		const sel = document.getElementById('fil-event');
		const current = sel.value;
		sel.innerHTML = '<option value="">All Events</option>' +
			r.eventTypes.map(e => '<option value="' + e + '"' + (e === current ? ' selected' : '') + '>' + e + '</option>').join('');
	}
	renderLogs();
}

function renderLogs() {
	const body = document.getElementById('log-body');
	if (allLogs.length === 0) {
		body.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-[#3a4260]">No logs found</td></tr>';
	} else {
		body.innerHTML = allLogs.map(logRow).join('');
	}
	document.getElementById('log-count').textContent = allLogs.length + ' logs loaded';
	document.getElementById('btn-more').classList.toggle('hidden', !hasMore);
}

function logRow(l) {
	const time = new Date(l.timestamp).toLocaleString(undefined, { hour12: false, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const sev = l.severity || 'INFO';
	const dataStr = l.data ? '<div class="log-data text-[#3a4260] mt-1">' + escapeHtml(typeof l.data === 'string' ? l.data : JSON.stringify(l.data, null, 1)) + '</div>' : '';
	return '<tr class="log-row border-b border-[#1a2555]/50">' +
		'<td class="px-4 py-2.5 text-[#6b7994] whitespace-nowrap">' + time + '</td>' +
		'<td class="px-4 py-2.5"><span class="sev-' + sev + ' font-medium">' + sev + '</span></td>' +
		'<td class="px-4 py-2.5 text-[#6b7994]">' + escapeHtml(l.eventType || '') + '</td>' +
		'<td class="px-4 py-2.5 text-[#6b7994]">' + escapeHtml(l.strategy || '—') + '</td>' +
		'<td class="px-4 py-2.5 text-gray-300">' + escapeHtml(l.message || '') + dataStr + '</td>' +
	'</tr>';
}

function escapeHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadMore() { loadLogs(false); }

function resetFilters() {
	document.getElementById('fil-event').value = '';
	document.getElementById('fil-severity').value = '';
	document.getElementById('fil-search').value = '';
	loadLogs(true);
}

// Init
const savedToken = localStorage.getItem('hq_api_token');
if (savedToken) document.getElementById('token').value = savedToken;
document.getElementById('token').addEventListener('change', (e) => {
	localStorage.setItem('hq_api_token', e.target.value);
	loadLogs(true);
});
document.getElementById('fil-search').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') loadLogs(true);
});

loadLogs(true);
</script>
</body>
</html>`;
