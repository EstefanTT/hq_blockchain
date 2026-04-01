// api/routes/health/ping.get.js
// GET /api/health/ping — basic health check, no auth required.

export default async function handler(req, res) {
	res.json({ success: true, message: 'pong 🏓', timestamp: new Date().toISOString() });
}
