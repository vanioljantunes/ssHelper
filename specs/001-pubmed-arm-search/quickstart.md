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
