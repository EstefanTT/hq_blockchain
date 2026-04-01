# services/cache/getters/

Read-only query functions against the runtime cache. Each file exports one getter.

Convention: getters never mutate state. They return data or `null` if not found.
