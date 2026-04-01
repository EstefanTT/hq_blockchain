// services/globalConfig/init.js
// Auto-executed on import. Loads .env, sets global paths, detects environment, loads static configs.

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ####################################################################################################################################
// #########################################################     INIT     #############################################################
// ####################################################################################################################################

dotenv.config();

// ####################################################################################################################################
// ##########################################################   VARIABLES   ###########################################################
// ####################################################################################################################################

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

const paths = {
	root: projectRoot,
	apiRoutes: path.join(projectRoot, 'api/routes'),
	logs: path.join(projectRoot, 'logs'),
	scheduler: path.join(projectRoot, 'scheduler'),
	config: path.join(projectRoot, 'config'),
	data: path.join(projectRoot, 'data'),
};

// ####################################################################################################################################
// ######################################################   HELPER FUNCTIONS   ########################################################
// ####################################################################################################################################

function detectEnvironment() {
	const machineType = process.env.MACHINE_TYPE;

	if (machineType === 'production_server') {
		return true;
	} else if (machineType === 'laptop_msi') {
		return false;
	} else if (!machineType) {
		console.error('CONFIG', 'MACHINE_TYPE is not defined. Set it in .env or .bashrc');
		process.exit(1);
	} else {
		console.error('CONFIG', `Unsupported MACHINE_TYPE: ${machineType}`);
		process.exit(1);
	}
}

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

(function initGlobalConfig() {
	global.path = paths;
	global.isProduction = detectEnvironment();

	// Static configs — add more as config/static/ grows
	// global.general = (await import('../../config/static/general.json', { assert: { type: 'json' } })).default;
})();
