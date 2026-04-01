// services/validation/index.js
// Validation helpers using Zod. Validates data at system boundaries.

// ####################################################################################################################################
// ##########################################################   FUNCTIONS   ###########################################################
// ####################################################################################################################################

/**
 * Validate data against a Zod schema. Returns { valid, data, errors }.
 */
export function validate(schema, data) {
	const result = schema.safeParse(data);
	if (result.success) {
		return { valid: true, data: result.data, errors: [] };
	}
	return {
		valid: false,
		data: null,
		errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
	};
}
