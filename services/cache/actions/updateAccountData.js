// services/cache/actions/updateAccountData.js
// Updates cached account data (balances, open orders, RC).

export default function updateAccountData(runtimeCache, fields) {
	Object.assign(runtimeCache.accountData, fields);
}
