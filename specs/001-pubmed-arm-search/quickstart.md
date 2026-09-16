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
