// api/routes/dashboard/logs-data.get.js
// GET /api/dashboard/logs-data?beforeId=&limit=50&eventType=&severity=&search=
// Paginated analysis logs from SQLite. Cursor-based pagination.

import auth from '../../middlewares/auth.js';

export default [auth, async function handler(req, res) {
	try {
		const { getAnalysisLogsPaginated, getDistinctEventTypes } = await import('../../../services/storage/botStore.js');

		const botName = req.query.bot || 'steem-dex-bot';
		const chainName = req.query.chain || 'steem';
		const limit = Math.min(parseInt(req.query.limit) || 50, 200);
		const beforeId = req.query.beforeId ? parseInt(req.query.beforeId) : null;
		const eventType = req.query.eventType || null;
		const severity = req.query.severity || null;
		const search = req.query.search || null;

		const logs = getAnalysisLogsPaginated(botName, chainName, { limit, beforeId, eventType, severity, search });
		const eventTypes = getDistinctEventTypes(botName, chainName);

		// Parse JSON data field
		for (const row of logs) {
			if (row.data) {
				try { row.data = JSON.parse(row.data); } catch { /* keep as string */ }
			}
		}

		return res.json({
			ok: true,
			logs,
			eventTypes,
			hasMore: logs.length === limit,
			nextBeforeId: logs.length > 0 ? logs[logs.length - 1].id : null,
		});
	} catch (err) {
		return res.status(500).json({ ok: false, error: err.message });
	}
}];
