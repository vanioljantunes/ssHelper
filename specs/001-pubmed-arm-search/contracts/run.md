# Contract: Search Run Orchestration (`src/core/run.ts`)

`runSearch(strategy, deps)` with injected `countQuery`, `now`, and `newId`; no network or
storage code in `core`.

## Steps

1. Commit pending text in all arms; validate; if issues, stop (no requests).
2. `query = buildQuery(...)`; if `null`, stop.
3. `result = await countQuery(query)`, then `metaResult = await countQuery(withMetaAnalysisArm(query))`.
4. If both are `error`, return failure (no row). Otherwise create a `SearchRun` and add it to
   history.
5. One run at a time; Search is disabled while running.
