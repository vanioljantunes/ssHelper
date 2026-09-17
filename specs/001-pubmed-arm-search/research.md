# Research: PubMed Arm-Based Search and Result History

All Technical Context unknowns are resolved below. Probes against NCBI were run on 2026-09-16.

## R1. Calling PubMed from the browser

- **Decision**: Call `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` directly from
  the browser with `db=pubmed&retmode=json&retmax=0&term=<query>&tool=ssHelper&email=<contact>`.
- **Rationale**: Probe returned `Access-Control-Allow-Origin: *` and exposes
  `X-RateLimit-Limit` / `X-RateLimit-Remaining`. No server or secret needed. Each user's IP gets
  its own quota.
- **Alternatives considered**: Vercel serverless proxy with an NCBI API key (10 req/s shared by
  all users; needs a queue and a secret; rejected for now, revisit with accounts).

## R2. Getting the count plus warnings

- **Decision**: Use `retmax=0` (not `rettype=count`). Read `esearchresult.count`,
  `querytranslation`, `warninglist` (`quotedphrasesnotfound`, `phrasesignored`,
  `outputmessages`), and `errorlist` if present.
- **Rationale**: Probe showed `rettype=count` returns only `{"count":"0"}` for a quoted phrase
  not in PubMed, while `retmax=0` returns
  `warninglist.quotedphrasesnotfound: ["\"zzqxunfoundphrase\""]`. Warnings explain surprising
  zero counts, which matters because multi-word terms are auto-quoted.
- **Alternatives considered**: `rettype=count` (smaller, but hides warnings).

## R3. Syntax problems

- **Decision**: Do not rely on PubMed to reject bad syntax. Validate locally before sending:
  unbalanced parentheses or unbalanced quotation marks in any term block the search with a
  message pointing to the term. PubMed `errorlist` entries, when present, are stored with the
  run and shown.
- **Rationale**: Probe with `((heart` returned a normal count (2,014,896) with no error, so
  PubMed silently repairs input. Silent repair could give a count for a query different from
  what the researcher sees (Principle I, FR-005e).
- **Alternatives considered**: Send as typed and trust PubMed (rejected: silent mismatch).

## R4. Stack

- **Decision**: Vite 6 + React 19 + TypeScript strict. Phase A runs locally; the same static
  build deploys to Vercel in Phase B.
- **Rationale**: Operator choice (2026-09-16). Matches triageHelper, so tooling and conventions
  are shared. No server needed (R1). Supabase JS client works in a SPA for the accounts feature.
- **Alternatives considered**: Next.js (server routes not needed yet), SvelteKit (different
  from the operator's other projects).

## R5. Browser storage

- **Decision**: `localStorage` with two keys: `sshelper:v1:history` (array of runs) and
  `sshelper:v1:draft` (current arms). JSON with a `schemaVersion` field. All access through
  `HistoryStore` / `DraftStore` interfaces. Writes wrapped in try/catch; on quota or privacy
  errors, the UI shows a warning that history could not be saved.
- **Rationale**: A run is about 1 KB; 1,000 runs is about 1 MB, under the typical 5 MB limit.
  Synchronous API keeps the code simple. The interface isolates the later Supabase move.
- **Alternatives considered**: IndexedDB (async and more code, not needed at this size).

## R6. Internationalization

- **Decision**: A plain typed message catalog `src/i18n/en.ts` exported as a constant object;
  components read strings from it. Dates formatted with `Intl.DateTimeFormat` using the
  browser locale, showing day, month, year, hour, and minute.
- **Rationale**: Meets FR-018 with zero dependencies. A library (e.g., i18next) can replace the
  catalog when a second language is added.
- **Alternatives considered**: i18next / react-intl now (unjustified for one language).

## R7. Throttling and failures

- **Decision**: A single in-memory queue spaces request starts at least 350 ms apart (under 3
  req/s). The two queries of a run go through the queue sequentially. On HTTP 429 or 5xx, retry
  up to 2 times with backoff (1 s, then 3 s). Timeout 15 s per request. Outcomes are typed:
  `ok`, `rate_limited`, `network`, `http`, `invalid_response`.
- **Rationale**: Satisfies FR-016 and Principle IV. Two requests per run fit easily in SC-003's
  5 s target.
- **Alternatives considered**: Parallel requests (risk of 429 when users click repeatedly).

## R8. Contact parameters

- **Decision**: `tool=ssHelper` and `email` from the required env variable
  `VITE_NCBI_CONTACT_EMAIL`, set in `.env.local` (gitignored, so the address is not committed to
  the public repository). `vite.config.ts` fails dev server start and build when it is missing.
  No NCBI account is needed; a probe with `tool` and `email` returned HTTP 200 (2026-09-16).
- **Rationale**: NCBI asks for tool and email to contact the developer about misuse. The email
  is public by nature (sent from the browser), so it is not a secret.
- **Alternatives considered**: Omitting email when unset (rejected: Constitution Principle IV
  requires it); hardcoding the address in source (rejected: public repository). An NCBI API key
  (free NCBI account) raises the limit to 10 req/s; not needed in Phase A.

## R9. Term commit and quoting rules

- **Decision**: Pure functions in `src/core/term.ts`, specified in
  [contracts/query-builder.md](./contracts/query-builder.md). Quoting applies to the text part
  before a trailing field tag (`[...]`) when that part contains a space and is not already
  quoted.
- **Rationale**: Directly testable with fixture tables; UI only calls these functions.
- **Alternatives considered**: Logic inside the React component (hard to test, violates VII).

## R10. Testing approach

- **Decision**: Vitest for `core`, `pubmed` (fixtures from real probes in
  `tests/fixtures/pubmed/`), and `storage` (jsdom `localStorage`). React Testing Library for term
  box keyboard and click behaviour. Playwright for the two user stories with network mocked.
  One live PubMed smoke test runs only when `LIVE_PUBMED=1`.
- **Rationale**: Constitution requires recorded-response tests and opt-in live tests.
- **Alternatives considered**: Only e2e tests (slow, brittle for quoting rules).

## R11. Study labels from Crossref (FR-024, added 2026-09-17)

- **Decision**: Name study boxes "Lastname, Year" from the Crossref REST API
  (`https://api.crossref.org/works/{doi}`, DOI path-encoded with `encodeURIComponent`, plus
  `mailto=<VITE_NCBI_CONTACT_EMAIL>` for the polite pool). The name is
  `message.author[0].family`, falling back to `author[0].name`. The year is the first integer in
  `published-print`, then `published-online`, then `published`, then `issued`
  (`date-parts[0][0]`). Client in `src/crossref/client.ts`: 15 s timeout, at most 2 retries on
  429 or 5xx, its own FIFO queue with at least 200 ms between request starts; it never throws.
  Formatting is pure (`formatStudyLabel` in `src/core/label.ts`).
- **Rationale**: Crossref answers CORS requests (`access-control-allow-origin: *`) and covers
  every registered DOI, including journals PubMed does not index: 10.1186/s43055-023-01181-z
  (Elshewy 2024) has no PubMed record but resolves in Crossref. The print year matches how the
  study is usually cited: 10.1002/jmri.29103 was online in 2023 and in print in 2024, and is cited
  as Yu 2024. Verified on 9 real DOIs (2026-09-17); five are recorded in
  `tests/fixtures/crossref/`. The request carries only the DOI the researcher entered, for a
  function the researcher invoked (a studies check), which fits Principle II (data limited to
  what the function needs, no tracking).
- **Alternatives considered**: PubMed esummary (rejected: misses non-indexed DOIs and would share
  the NCBI throttle, slowing the checks); a label from the `issued` year only (rejected:
  gives the online year, Yu 2023).
