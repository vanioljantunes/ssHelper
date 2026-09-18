<!--
Sync Impact Report
==================
Version change: 2.1.0 -> 2.2.0
Bump rationale: MINOR. Materially expands Delivery Phase A: it MAY be deployed publicly as a
preview (e.g. Vercel) without accounts, provided no secrets or personal data are embedded in the
build and all user data stays in the visitor's browser. Motivated by FR-025 (each visitor enters
their own NCBI contact email at runtime). No principle removed or redefined.
(2.1.0: Delivery Phases section, local test phase before hosted phase, 2026-09-16. 2.0.0: hosted
web app with accounts, AI premium deferred, 2026-09-16. 1.0.0: initial, 2026-09-16.)

Modified principles: none

Modified sections:
  - Delivery Phases (Phase A public preview allowed under conditions)

Added sections: none

Removed sections: none

Templates and dependent files:
  ✅ .specify/memory/constitution.md          (amended)
  ✅ .specify/templates/plan-template.md       (version reference updated to v2.2.0)
  ✅ specs/001-pubmed-arm-search/plan.md       (version references updated to v2.2.0)
  ✅ .specify/templates/spec-template.md       (reviewed; no change needed)
  ✅ .specify/templates/tasks-template.md      (reviewed; no change needed)
  ✅ README.md / CLAUDE.md                     (Phase A preview and visitor contact email noted)

Deferred TODOs:
  - TODO(PREMIUM_TIER): pricing, usage limits, and AI provider for premium synonyms; requires
    amendment before any premium work starts.
-->

# ssHelper Constitution

ssHelper is a free, public web application that helps researchers build systematic review
search strategies. It has three functions: (1) expanding concept synonyms (MeSH-based in the
free version; AI-assisted in a future premium tier); (2) validating a PubMed strategy against a
set of known relevant studies entered by
DOI or link; and (3) translating a strategy into the syntax of other bibliographic databases,
in the spirit of the Polyglot Search Translator (SR-Accelerator). It assists the searcher; it
does not replace the searcher's or an information specialist's judgment.

## Product Goals and Clarifications

### Session 2026-09-16

- Q: Who is ssHelper for? -> A: A public, free tool for any systematic review researcher.
- Q: How is it delivered? -> A: As a hosted web application only. No downloadable or local
  version for users.
- Q: Where are saved projects stored at first release? -> A: User accounts with Supabase from
  day one; projects stored in the cloud.
- Q: How is AI synonym expansion provided? -> A: Not in the free launch. It becomes a premium
  tier after launch, using the project's own AI API with usage limits and charges to be
  defined later.
- Q: Does the free launch include synonym help? -> A: Yes, non-AI: MeSH term and entry-term
  lookup via NCBI plus manual terms per concept.

## Delivery Phases

- **Phase A, local test version (current)**: runs on the developer's machine through the local
  development server for testing. No accounts, no hosting, no server secrets. Data is kept in
  browser storage behind the storage interfaces required by Principle VII. Principle II account,
  row-level security, account deletion, and project file export duties do not yet apply; all
  other principles apply in full. Phase A MAY be deployed publicly as a preview (e.g. Vercel)
  without accounts, provided no secrets or personal data are embedded in the build and all user
  data stays in the visitor's browser.
- **Phase B, hosted version**: deployed on Vercel with Supabase. Principle II applies in full.
  Moving from Phase A to Phase B MUST replace browser storage with Supabase behind the same
  interfaces, add accounts and row-level security, and offer import of Phase A data.
- A feature plan MUST state which phase it targets in its Constitution Check.

## Core Principles

### I. Researcher Owns the Strategy

- The application MUST NOT silently change a search strategy. Synonym suggestions,
  translations, and fixes are proposals that the researcher accepts, edits, or rejects.
- Suggested terms MUST be visibly distinct from terms the researcher entered until accepted.
- Translated strategies MUST be presented as drafts that require review before use, with a
  visible notice that controlled vocabulary does not map one-to-one between databases.

Rationale: Search strategies are reported and peer reviewed (PRISMA-S, PRESS). The researcher
stays accountable for every term and operator.

### II. Hosted Web App, Private by Default

- ssHelper MUST be delivered to users as a hosted web application (Phase B). No downloadable
  build is offered to users. The Phase A local version is for development and testing only.
- Users sign in to an account (Supabase Auth). Projects (strategies, synonym lists, validation
  study sets, results) are stored in Supabase and are private to their owner by default.
- Access control MUST be enforced in the database (row-level security), not only in the UI. A
  user MUST NOT be able to read or modify another user's projects.
- Users MUST be able to export a project to a file, import it back, and delete their account
  with all associated data.
- Data collected is limited to what the functions need. No third-party tracking or selling of
  data; any product analytics MUST be privacy-preserving and disclosed.
- Server-held secrets (service-role keys, NCBI key, future AI keys) MUST never reach the client.

Rationale: A web app lowers the barrier for researchers; their unpublished strategies still
deserve strict privacy.

### III. Free Core, AI Deferred to Premium

- The free version MUST provide: strategy validation against PubMed, translation to other
  databases, and non-AI synonym help (MeSH lookup, entry terms, manual terms per concept).
- AI synonym expansion is out of scope for the free launch. It is planned as a premium tier
  that uses the project's own AI API with usage limits and charges. Building it requires a
  constitution amendment defining pricing, limits, and provider (TODO(PREMIUM_TIER)).
- The app MUST NOT ask users for their own AI API keys.
- AI MUST NOT be used for strategy validation or syntax translation, in any tier; those paths
  stay deterministic (Principles IV, V).
- When the premium tier exists, free features MUST remain fully usable without it.

Rationale: Launch a useful, zero-cost core first; paid AI must not erode the free tool.

### IV. Validation Uses Real Database Evidence

- Checking whether a study is retrieved MUST query PubMed itself (NCBI E-utilities), never an
  estimate or model.
- Studies MAY be entered as DOI, doi.org link, PubMed link, PMID, or PMC link. Each MUST be
  resolved to a PMID with the resolution method recorded.
- Each study result MUST be one of: **Found**, **Not found**, or **Unresolved** (not in
  PubMed, invalid identifier, or API error). Unresolved MUST NOT be reported as Not found.
- Each validation run MUST record the exact query sent, run timestamp, total hit count, and
  per-study outcome.
- API use MUST respect NCBI usage policy: rate limits (3 requests/s without key, 10/s with an
  NCBI key), `tool` and `email` parameters, and backoff on errors. Calls routed through the
  server share one quota across users and MUST be queued or throttled accordingly.

Rationale: A validation that silently confuses "missing from PubMed" with "missed by the
strategy" misleads the searcher.

### V. Transparent, Deterministic Translation

- Translation between databases MUST be rule-based: parse the source strategy into a
  structured representation, then render it with per-database syntax rules.
- Same input and same rule version MUST produce identical output.
- Every construct that cannot be translated exactly (field tags, proximity operators,
  truncation or wildcard differences, explosion, subheadings, controlled vocabulary) MUST be
  flagged with an explanation. Nothing may be dropped silently.
- Controlled vocabulary (e.g., MeSH) MUST NOT be presented as equivalent to another thesaurus
  (e.g., Emtree) unless a verified mapping is used; otherwise it is flagged for manual review.
- Unparseable input MUST produce a clear error pointing to the location, not a partial
  translation.

Rationale: A wrong translation that looks right is worse than no translation.

### VI. Saved and Reproducible Work

- Researchers MUST be able to save and reopen projects, including validation study sets.
- Validation runs MUST be appended, not overwritten, so strategy iterations can be compared
  (which studies each version found).
- Exports MUST include enough to report the search: strategy text per database, date, hit
  counts, and validation results. File export is required from Phase B; Phase A MAY offer copy
  only.
- Researcher-initiated deletion of a project, or of the account and all its data, is always
  permitted.

Rationale: Search development is iterative and must be reported transparently.

### VII. Modularity

- Strategy parsing, database dialects, synonym providers, PubMed client, identifier
  resolution, auth, storage, and UI MUST be independent components with explicit interfaces.
- Each database dialect MUST be a self-contained module so new databases can be added
  without changing the parser or other dialects.
- The core (parser, translator, validator) MUST run without the UI, database, or any AI
  provider, so it can be tested in isolation.
- The future AI synonym provider MUST plug in behind the same synonym-provider interface as
  the MeSH provider.

Rationale: Databases and providers change independently; each piece must be testable alone.

### VIII. No Unjustified Complexity

- Baseline stack is a web frontend on Vercel with Supabase (Auth, Postgres). Parsing and
  translation run client-side where possible; server functions only where needed (secrets,
  shared rate limiting, CORS).
- New services, dependencies, or infrastructure beyond this baseline MUST be justified in the
  feature plan's Complexity Tracking table.

Rationale: A small team must be able to run and afford a free public tool.

## Functional Scope and Domain Constraints

- Function 1, synonym expansion (free): manual term entry per concept plus MeSH term and
  entry-term lookup via NCBI. AI suggestions: premium, deferred.
- Function 2, retrieval validation: source strategy is PubMed syntax; studies by DOI, PMID, or
  link; outcomes Found / Not found / Unresolved; results saved per project.
- Function 3, translation: PubMed is the first source dialect. Target databases are defined per
  feature spec (candidates: Ovid MEDLINE, Ovid Embase, Embase.com, Cochrane Library, Web of
  Science, Scopus, CINAHL/EBSCO, PsycINFO, Google Scholar). Each target is added only with
  tests covering its syntax rules.
- Validation against databases other than PubMed is out of scope unless a public, permitted
  API exists and an amendment or feature plan justifies it.
- UI copy MUST state that outputs are aids for strategy development, not a substitute for peer
  review of the search (PRESS).

## Development Workflow & Quality Gates

- Every feature plan MUST pass the Constitution Check in `plan-template.md` before research and
  again after design.
- Parser and each dialect MUST have fixture tests: input strategy -> expected output and
  expected warnings. Changing a rule requires updating fixtures deliberately.
- Determinism MUST be tested for translation.
- Identifier resolution MUST have tests for DOI, doi.org link, PubMed link, PMID, PMC link, and
  invalid input, including the Unresolved path.
- PubMed client MUST be tested against recorded responses; live-API tests are opt-in.
- Row-level security MUST be tested: a user cannot read or write another user's projects.
- Tests MUST verify server secrets never appear in client bundles, exports, or logs.
- Tests MUST verify account deletion removes all of that user's data.

## Governance

- This constitution supersedes other project practices. Where README, CLAUDE.md, or other
  guidance conflicts, this document wins until amended.
- Amendments require: a written rationale, an updated Sync Impact Report, propagation to
  dependent templates, and a version bump.
- Versioning follows semantic versioning:
  - MAJOR: removal or backward-incompatible redefinition of a principle (e.g., changing
    delivery model or moving a free feature to paid).
  - MINOR: new principle or section, or materially expanded guidance.
  - PATCH: clarifications, wording, typo fixes.
- Compliance review: every spec, plan, task list, and code review MUST check alignment with
  these principles. Violations MUST be fixed or justified in Complexity Tracking.

**Version**: 2.2.0 | **Ratified**: 2026-09-16 | **Last Amended**: 2026-09-18
