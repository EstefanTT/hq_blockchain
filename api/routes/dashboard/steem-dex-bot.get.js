// api/routes/dashboard/steem-dex-bot.get.js
// GET /api/dashboard/steem-dex-bot — Legacy redirect → generic bot page.

export default function handler(_req, res) {
	res.redirect(301, '/api/dashboard/bots/steem-dex-bot');
}

