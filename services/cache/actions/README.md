# services/cache/actions/

Mutation functions that update the runtime cache. Each file exports one action.

Convention: action functions update cache **and** optionally persist to storage (write-through pattern).
