// services/storage/snapshots.js
// Point-in-time snapshots of portfolio state, balances, positions.
// Useful for historical tracking and debugging.

import { appendJsonl } from './files.js';
import path from 'path';

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Save a portfolio snapshot (balances + positions at a point in time).
 */
export function saveSnapshot(snapshotType, data) {
	const filePath = path.join(global.path.data, 'snapshots', `${snapshotType}.jsonl`);
	appendJsonl(filePath, data);
	console.log('DB', `Snapshot saved: ${snapshotType}`);
}
