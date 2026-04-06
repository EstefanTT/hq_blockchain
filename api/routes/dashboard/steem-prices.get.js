// api/routes/dashboard/steem-prices.get.js
// GET /api/dashboard/steem-prices — Legacy redirect → generic bot data endpoint.

export default function handler(_req, res) {
	res.redirect(301, '/api/dashboard/bots/data/steem-dex-bot');
}
