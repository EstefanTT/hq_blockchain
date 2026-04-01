// core/risk/killSwitch.js
// Emergency stop — halts all trading activity immediately.
// Can be triggered manually (API/Telegram) or automatically (cascading losses, anomaly detection).
// When active: all executeTrade calls are rejected, all running strategies are paused.

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

let killed = false;
let killedAt = null;
let killedReason = '';

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

export function activate(reason = 'Manual kill switch') {
	killed = true;
	killedAt = new Date().toISOString();
	killedReason = reason;
	console.error('RISK', `🚨 KILL SWITCH ACTIVATED: ${reason}`);
}

export function deactivate() {
	killed = false;
	killedAt = null;
	killedReason = '';
	console.warn('RISK', 'Kill switch deactivated');
}

export function isKilled() {
	return { killed, killedAt, killedReason };
}
