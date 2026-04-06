// api/utils/loadRoutes.js
// File-based route auto-loader (Nuxt 3 style). Ported from hq-home.
// Convention: routes/domain/action.method.js → METHOD /api/domain/action

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const supportedMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

/**
 * Recursively loads route files and registers them on the Express app.
 * @param {Express.Application} app
 * @param {string} dir - Absolute path to routes directory
 * @param {string} baseRoute - e.g. '/api'
 */
export default async function loadRoutes(app, dir, baseRoute = '/api') {
	const walk = async (currentPath, routePrefix) => {
		const files = fs.readdirSync(currentPath);

		for (const file of files) {
			const fullPath = path.join(currentPath, file);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				const subRoute = path.join(routePrefix, file);
				await walk(fullPath, subRoute);
			} else if (file.endsWith('.js')) {
				const match = file.match(/^(.*?)(?:\.(get|post|put|delete|patch|options|head))?\.js$/i);
				if (!match) continue;

				const [, name, method] = match;
				const routePath = path.join(routePrefix, name === 'index' ? '' : name);
				const routeUrl = routePath.replace(/\\/g, '/').replace(/\[(\w+)\]/g, ':$1');

				const moduleUrl = pathToFileURL(fullPath).href;
				const mod = await import(moduleUrl);
				const handler = mod.default || mod;

				const fullUrl = path.posix.join(baseRoute, routeUrl);
				const isFunction = typeof handler === 'function';
				const isValidArray = Array.isArray(handler) && handler.every(fn => typeof fn === 'function');

				if (!(isFunction || isValidArray)) {
					console.error('API', `❌ Invalid export in ${file} — must export a function or array of functions.`);
					continue;
				}

				const handlers = isFunction ? [handler] : handler;

				if (method && supportedMethods.includes(method.toLowerCase())) {
					app[method.toLowerCase()](fullUrl, ...handlers);
					console.info('API', `🔌  [${method.toUpperCase()}] ${fullUrl}`);
				} else {
					app.use(fullUrl, ...handlers);
					console.info('API', `➡️  [USE] ${fullUrl}`);
				}
			}
		}
	};

	await walk(dir, '');
}
