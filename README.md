# ssHelper

ssHelper helps researchers build systematic review search strategies. It is a free, public web
application in development. It assists the searcher; it does not replace the searcher's or an
information specialist's judgment, and it is not a substitute for peer review of the search
(PRESS).

## Planned functions

1. **Synonym expansion**: manual terms per concept plus MeSH term and entry-term lookup
   (AI-assisted suggestions are a later premium tier).
2. **Retrieval validation**: check a PubMed strategy against known relevant studies entered by
   DOI, PMID, or link.
3. **Translation**: translate a PubMed strategy into the syntax of other bibliographic
   databases, with every inexact construct flagged.

## What works now (feature 001)

- Build a PubMed strategy in **arms**: terms inside an arm are joined with OR, arms are joined
  with AND. Multi-word terms are quoted automatically; one click on a quotation mark removes the
  quotes.
- Press **Search** to get two PubMed counts: the strategy, and the strategy with an extra
  `("meta-analysis")` arm.
- Each visitor types a **contact email** once (sent to PubMed and Crossref, saved only in that
  browser); Search stays disabled until it is set.
- Every run is kept in a **history** table (date and time, query, both counts) that survives
  page reloads and can be loaded back, copied, or deleted.

Counts come from PubMed at the time of the run and change as PubMed is updated.

## Delivery phases

- **Phase A, local test version (current)**: runs on your machine with the Vite dev server,
  and may be deployed publicly as a preview (Vercel) without accounts. History, draft, and the
  contact email are stored in this browser (`localStorage`); the build embeds no secrets or
  personal data.
- **Phase B, hosted version (next)**: Vercel hosting and Supabase accounts, with history moved
  into the signed-in account.

## Requirements

- Node 20 or newer and npm.
- Nothing else is required. Each visitor enters their own contact email in the app. No NCBI
  account is needed.
- Optional, for local development: copy `.env.example` to `.env.local` and set
  `VITE_NCBI_CONTACT_EMAIL=you@example.org` to pre-fill that field. `.env.local` is gitignored.
  Leave the variable unset for public builds, so no personal address ends up in the bundle.

## Development

```bash
npm install
npx playwright install chromium   # once, for end-to-end tests
npm run dev                       # http://localhost:5180 (fixed port; fails if taken)
```

| Command                           | What it does                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `npm run typecheck`               | TypeScript strict check                                                           |
| `npm run lint`                    | ESLint, including the rule that `src/core` has no UI, network, or storage imports |
| `npm test`                        | Vitest: core rules, PubMed client against recorded responses, storage, components |
| `npm run test:e2e`                | Playwright (Chromium) with PubMed mocked, including axe accessibility checks      |
| `LIVE_PUBMED=1 npm run test:live` | Opt-in tests against the real PubMed API (about 60 requests)                      |
| `npm run build`                   | Production build into `dist/`                                                     |
| `npm run check:bundle`            | Scans `dist/` for server secrets (run after build)                                |
| `npm run preview`                 | Serves the production build locally                                               |

On PowerShell, set the live flag with `$env:LIVE_PUBMED = '1'; npm run test:live`.

## PubMed usage

ssHelper calls NCBI E-utilities `esearch` directly from the browser with `tool=ssHelper` and
the contact email the visitor entered, as NCBI asks; no request is sent without one. Requests are queued at least 350 ms apart (under the limit of
3 requests per second without an API key) and retried with backoff on rate limiting. See the
[NCBI E-utilities usage policy](https://www.ncbi.nlm.nih.gov/books/NBK25497/).

## Project rules

The [constitution](.specify/memory/constitution.md) defines the principles every feature
follows. Feature specifications, plans, contracts, and task lists live in [specs/](specs/).
