// api/routes/dashboard/shared/sidebar.js
// Shared sidebar renderer for all dashboard pages.
// Returns HTML string for the sidebar navigation.

import { listBots } from '../../../../services/botRegistry/index.js';

function esc(s) {
	return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render the sidebar HTML.
 * @param {string} activePage - 'home' | 'logs' | '<bot-name>'
 * @returns {string} HTML string
 */
export function renderSidebar(activePage = 'home') {
	const bots = listBots();
	const act = 'nav-item nav-active flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium';
	const inact = 'nav-item nav-inactive flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7994] text-sm';
	const disabled = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#3a4260] text-sm cursor-not-allowed select-none';

	const categories = {
		trading: { label: 'Trading Bots', icon: '🤖' },
		monitoring: { label: 'Monitoring', icon: '📊' },
		analysis: { label: 'Analysis', icon: '🔬' },
	};

	// Group bots by category
	const grouped = {};
	for (const cat of Object.keys(categories)) grouped[cat] = [];
	for (const b of bots) {
		const cat = b.category || 'trading';
		if (!grouped[cat]) grouped[cat] = [];
		grouped[cat].push(b);
	}

	// Build collapsible category sections
	const catSections = Object.entries(categories).map(([cat, meta]) => {
		const items = grouped[cat] || [];
		if (!items.length) return '';
		const isActive = items.some(b => b.name === activePage);

		const links = items.map(b => {
			if (b.ready) {
				return `\t\t\t<a href="/api/dashboard/bots/${encodeURIComponent(b.name)}" class="${activePage === b.name ? act : inact}">
				<span>🤖</span><span class="nav-label">${esc(b.displayName)}</span>
			</a>`;
			}
			return `\t\t\t<div class="${disabled}">
				<span>🤖</span><span class="nav-label">${esc(b.displayName)}</span>
			</div>`;
		}).join('\n');

		return `\t\t<div class="nav-category">
			<button onclick="this.parentElement.classList.toggle('collapsed')" class="flex items-center justify-between w-full px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-[#4a5580] hover:text-[#6b7994] transition-colors">
				<span class="flex items-center gap-2"><span>${meta.icon}</span><span class="nav-label">${meta.label}</span></span>
				<svg class="nav-chevron w-3 h-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
			</button>
			<div class="nav-category-items${isActive ? '' : ''}">
${links}
			</div>
		</div>`;
	}).filter(Boolean).join('\n');

	return `<aside class="sidebar fixed top-0 left-0 bg-[#0c1230] border-r border-[#1a2555] flex flex-col z-50">
	<div class="px-5 py-5 border-b border-[#1a2555]">
		<div class="flex items-center gap-3">
			<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4a8eff] to-[#7c4dff] flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">H</div>
			<span class="nav-label text-sm font-semibold tracking-wide text-white">hq_blockchain</span>
		</div>
	</div>
	<nav class="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
		<a href="/api/dashboard" class="${activePage === 'home' ? act : inact}">
			<span>🏠</span><span class="nav-label">Home</span>
		</a>
${catSections}
		<a href="/api/dashboard/logs" class="${activePage === 'logs' ? act : inact}">
			<span>📋</span><span class="nav-label">Logs Explorer</span>
		</a>
		<div class="${disabled}">
			<span>⚙️</span><span class="nav-label">Settings</span>
		</div>
	</nav>
	<div class="px-5 py-4 border-t border-[#1a2555] text-[10px] text-[#3a4260]">
		<span class="nav-label">© 2025 hq_blockchain · v1.0</span>
	</div>
</aside>`;
}
