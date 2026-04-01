// services/storage/files.js
// File I/O helpers — JSONL append, JSON read/write. For append-heavy data and raw dumps.

import { appendFileSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Append a JSON object as a single line to a JSONL file.
 */
export function appendJsonl(filePath, data) {
	const dir = path.dirname(filePath);
	mkdirSync(dir, { recursive: true });
	const line = JSON.stringify({ ...data, _ts: new Date().toISOString() }) + '\n';
	appendFileSync(filePath, line);
}

/**
 * Read and parse a JSON file. Returns null if not found.
 */
export function readJson(filePath) {
	try {
		return JSON.parse(readFileSync(filePath, 'utf-8'));
	} catch {
		return null;
	}
}

/**
 * Write an object to a JSON file (pretty-printed).
 */
export function writeJson(filePath, data) {
	const dir = path.dirname(filePath);
	mkdirSync(dir, { recursive: true });
	writeFileSync(filePath, JSON.stringify(data, null, 2));
}
