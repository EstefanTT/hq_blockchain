// api/middlewares/errorHandler.js
// Global Express error handler. Catches unhandled errors from route handlers.

export default function errorHandler(err, req, res, _next) {
	console.error('API', `${req.method} ${req.path} — ${err.message}`);
	res.status(err.status || 500).json({
		error: err.message || 'Internal Server Error',
	});
}
