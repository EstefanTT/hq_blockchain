// connectors/apis/shared/rateLimiter.js
// Simple token-bucket rate limiter. Prevents hitting API rate limits.
// Usage: const limiter = createRateLimiter(5, 1000); await limiter.wait();

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Create a rate limiter.
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Window duration in milliseconds
 */
export function createRateLimiter(maxRequests, windowMs) {
	const timestamps = [];

	return {
		async wait() {
			const now = Date.now();
			// Remove timestamps outside the window
			while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
				timestamps.shift();
			}
			if (timestamps.length >= maxRequests) {
				const waitTime = timestamps[0] + windowMs - now;
				await new Promise(r => setTimeout(r, waitTime));
			}
			timestamps.push(Date.now());
		}
	};
}
