# Scripts

`seed-e2e.mjs` creates the tiny repository fixture used by browser tests. It refuses any database not named `codedoc_test`; never point it at the normal application database.

See [testing instructions](../docs/TESTING.md). Application runtime code remains under `src/`.
