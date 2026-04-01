# services/validation/

Zod-based schema validation. Used at system boundaries: API inputs, config files, strategy parameters, connector responses.

| Path | Role |
|---|---|
| `index.js` | Validation helpers (validate, assert) |
| `schemas/` | Zod schema definitions organized by domain |
