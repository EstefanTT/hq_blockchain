// services/cache/actions/updateAccountData.js
// Updates cached account data (balances, open orders, RC).

export default function updateAccountData(botState, fields) {
	Object.assign(botState.accountData, fields);
}
