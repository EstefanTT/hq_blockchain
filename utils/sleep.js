// utils/sleep.js
// Promise-based delay. Usage: await sleep(1000);

export default function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
