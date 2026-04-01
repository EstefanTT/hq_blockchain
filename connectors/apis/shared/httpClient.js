// connectors/apis/shared/httpClient.js
// Shared HTTP client — Axios wrapper with timeout, retries, and error normalization.
// All API connectors use this instead of raw axios.

import axios from 'axios';

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Create a configured HTTP client for an API provider.
 * @param {object} opts - { baseURL, timeout?, headers?, maxRetries? }
 */
export function createHttpClient({ baseURL, timeout = 10000, headers = {}, maxRetries = 2 }) {
	const client = axios.create({ baseURL, timeout, headers });

	client.interceptors.response.use(
		res => res,
		async err => {
			const config = err.config;
			config._retryCount = config._retryCount || 0;

			if (config._retryCount < maxRetries && (!err.response || err.response.status >= 500)) {
				config._retryCount++;
				const delay = config._retryCount * 1000;
				await new Promise(r => setTimeout(r, delay));
				return client(config);
			}

			throw err;
		}
	);

	return client;
}
