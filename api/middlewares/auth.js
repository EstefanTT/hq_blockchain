// api/middlewares/auth.js
// API token authentication middleware. Validates X-API-Token header.

export default function auth(req, res, next) {
	const token = req.headers['x-api-token'];

	if (!token || token !== process.env.API_TOKEN) {
		console.warn('AUTH', `Unauthorized request from ${req.ip}`);
		return res.status(401).json({ error: 'Unauthorized' });
	}

	next();
}
