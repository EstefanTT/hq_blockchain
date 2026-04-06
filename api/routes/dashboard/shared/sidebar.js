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

	const botLinks = bots.map(b =>
		`\t\t<a href="/api/dashboard/bots/${encodeURIComponent(b.name)}" class="${activePage === b.name ? act : inact}">\n\t\t\t<span>🤖</span><span class="nav-label">${esc(b.displayName)}</span>\n\t\t</a>`
	).join('\n');

	return `<aside class="sidebar fixed top-0 left-0 bg-[#0c1230] border-r border-[#1a2555] flex flex-col z-50">
	<div class="px-5 py-5 border-b border-[#1a2555]">
		<div class="flex items-center gap-3">
			<div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4a8eff] to-[#7c4dff] flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-500/20">H</div>
			<span class="nav-label text-sm font-semibold tracking-wide text-white">hq_blockchain</span>
		</div>
	</div>
	<nav class="flex-1 py-5 px-3 space-y-1">
		<a href="/api/dashboard" class="${activePage === 'home' ? act : inact}">
			<span>🏠</span><span class="nav-label">Home</span>
		</a>
${botLinks}
		<a href="/api/dashboard/logs" class="${activePage === 'logs' ? act : inact}">
			<span>📋</span><span class="nav-label">Logs Explorer</span>
		</a>
		<div class="${disabled}">
			<span>🔬</span><span class="nav-label">Research</span>
		</div>
		<div class="${disabled}">
			<span>⚙️</span><span class="nav-label">Settings</span>
		</div>
	</nav>
	<div class="px-5 py-4 border-t border-[#1a2555] text-[10px] text-[#3a4260]">
		<span class="nav-label">© 2025 hq_blockchain · v1.0</span>
	</div>
</aside>`;
}
