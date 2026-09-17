# Quickstart: PubMed Arm-Based Search and Result History

Validation guide proving the feature works end to end.

## Prerequisites

- Node 20+ and npm.
- Required: `.env.local` at the repository root containing `VITE_NCBI_CONTACT_EMAIL=<contact
  address>` (gitignored). No NCBI account is needed.

## Setup and run

```bash
npm install
npm run dev          # http://localhost:5173
```

## Automated checks

```bash
npm run typecheck
npm test                          # Vitest: core fixtures, pubmed client fixtures, storage
npm run test:e2e                  # Playwright, PubMed mocked
LIVE_PUBMED=1 npm run test:live   # optional, calls real PubMed
npm run build && npm run preview  # local production build (Phase A; Vercel comes in Phase B)
```

## Manual scenarios

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open the page with site data cleared | 3 empty arms, "AND" between them, Search disabled |
| 2 | Arm 1: type `heart failure`, Enter; type `cardiac failure`, Enter | `"heart failure"` OR `"cardiac failure"` OR [input] |
| 3 | Arm 3: type `diabetes`, Enter | `diabetes` without quotes |
| 4 | Click a quotation mark on `"cardiac failure"` | Shows `cardiac failure`, not in edit mode |
| 5 | Click the `cardiac failure` text, press Enter | Quotes return |
| 6 | Arm 3: type `sglt2 inhibitors` without Enter, press Search | Committed as `"sglt2 inhibitors"`; query `("heart failure" OR "cardiac failure") AND (diabetes OR "sglt2 inhibitors")` |
| 7 | Run the same query and the query with `AND ("meta-analysis")` on pubmed.ncbi.nlm.nih.gov | Same counts (SC-002) |
| 8 | Check history | New top row: date and time to the minute, query, both counts |
| 9 | Reload the page | Row and current arms still present |
| 10 | Press Copy on the row; paste into PubMed | Exact query text |
| 11 | Add an arm, then delete the middle arm | One "AND" per gap; terms intact |
| 12 | Type `(heart` as a term, Enter | Error on the term; Search disabled |
| 13 | Go offline (DevTools), press Search | Message shown; no row saved |
| 14 | Press Load on an older row | Arms replaced with that row's terms |
| 15 | Clear history and confirm | "No searches yet." |

## References

- Rules: [contracts/query-builder.md](./contracts/query-builder.md)
- PubMed calls: [contracts/pubmed-client.md](./contracts/pubmed-client.md)
- Search run: [contracts/run.md](./contracts/run.md)
- Storage: [contracts/storage.md](./contracts/storage.md)
- UI behaviour: [contracts/ui.md](./contracts/ui.md)
- Entities: [data-model.md](./data-model.md)

## Deviations

Recorded during implementation (2026-09-16). Each is the smallest decision that kept the
documents consistent.

1. `validateTerm` returns the issue kind (`'unbalanced_parentheses' | 'unbalanced_quotes' | null`)
   instead of a full `Issue`, because a term alone has no `armId`. `validateStrategy` attaches
   `armId` and `termId`.
2. `commitTerm` keeps a body that already contains a quotation mark exactly as typed (not only a
   fully wrapped body). This applies "never quote twice" to input such as `"heart failure`, which
   stays as typed and is then flagged by `validateTerm` (FR-020) instead of becoming
   `""heart failure"`.
3. `validateStrategy` also checks pending (uncommitted) text, with no `termId`, so Search is
   disabled before an invalid pending term would be auto-committed.
4. `runSearch` returns a `status` discriminant: `invalid` (issues), `empty` (null query),
   `failed` (both counts failed, no run), `completed` (run). `empty` is the explicit form of the
   "null query stops" step in contracts/run.md.
5. `App` accepts an optional `countQuery` prop (defaults to the real PubMed client) so component
   tests can inject a fake; later also the history and draft stores.
6. Playwright starts its own dev server on port 5183 (override with `E2E_PORT`) instead of 5173,
   because 5173 is often used by another local Vite app. `npm run dev` still prefers 5173 but no
   longer fails when it is taken (Vite picks the next free port).
7. Vitest workers run with `--no-experimental-webstorage` when Node supports that flag. Node 25
   exposes an incomplete global `localStorage` that shadows the jsdom one.
8. `SaveResult` has a third failure reason, `duplicate`, returned by `HistoryStore.add` when a
   run with the same id exists (contracts/storage.md requires rejection but lists only `quota`
   and `unavailable`). The UI does not show the storage warning for `duplicate`.
9. Confirmations (Load over existing terms, Clear history) are inline `alertdialog` panels with
   Confirm and Cancel buttons instead of `window.confirm`, so they are keyboard reachable,
   styled, and testable without browser dialogs.
10. `HistoryStore.clear` writes an empty versioned history instead of removing the key.
11. Recorded fixtures in `tests/fixtures/pubmed/` are excluded from Prettier so their bytes stay
    as returned by NCBI.
12. Manual scenarios 1-15 were run as automated Playwright equivalents (tests/e2e) instead of
    by hand: offline (scenario 13) is simulated by aborting the esearch route, and clipboard
    reads use granted clipboard permissions. Scenario 7 (compare with the PubMed website) was
    checked with a one-off headless script, not committed, on 2026-09-16; all 6 counts matched
    esearch exactly:

    | Query | esearch | pubmed.ncbi.nlm.nih.gov |
    |-------|---------|-------------------------|
    | `("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")` | 2706 | 2706 |
    | same `AND ("meta-analysis")` | 385 | 385 |
    | `(diabetes) AND (metformin)` | 25099 | 25099 |
    | same `AND ("meta-analysis")` | 1093 | 1093 |
    | `("atrial fibrillation") AND (apixaban OR rivaroxaban) AND (stroke)` | 3465 | 3465 |
    | same `AND ("meta-analysis")` | 324 | 324 |

13. The live SC-002 test (T040 c) compares each strategy count from the app client with a
    direct esearch request for the same term (both through one shared throttle), and the SC-003
    timing (T040 d) is measured on those same 20 runs, so the file makes about 62 requests
    instead of 100. Result on 2026-09-16: 20 of 20 matched; p95 run time 1.86 s.
14. The term remove control shows a plain `x` (from `en.removeTermSymbol`) with the accessible
    name "Remove term". Quote, text, and remove controls in a term box have a 24 px minimum
    target size to pass the axe WCAG 2.2 `target-size` rule.
