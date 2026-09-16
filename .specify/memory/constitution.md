<!--
Sync Impact Report
==================
Version change: (template) -> 1.0.0
Bump rationale: Initial ratification. All placeholders replaced with project principles.

Modified principles: none (initial adoption)

Added principles:
  I.    Researcher Owns the Strategy
  II.   Local-First, No Account Required
  III.  AI Is Optional and Bring-Your-Own-Key
  IV.   Validation Uses Real Database Evidence
  V.    Transparent, Deterministic Translation
  VI.   Saved and Reproducible Work
  VII.  Modularity
  VIII. No Unjustified Complexity

Added sections:
  - Functional Scope and Domain Constraints
  - Development Workflow & Quality Gates
  - Governance

Removed sections: none

Templates and dependent files:
  ✅ .specify/memory/constitution.md          (created from template)
  ✅ .specify/templates/plan-template.md       (Constitution Check gates rewritten for ssHelper)
  ✅ .specify/templates/tasks-template.md      (principle-driven polish tasks rewritten)
  ✅ .specify/templates/spec-template.md       (reviewed; no mandatory section change needed)
  ✅ .specify/templates/checklist-template.md  (reviewed; no change needed)
  ✅ speckit-* skills (~/.claude/skills)       (reviewed; generic, no agent-specific references)
  ⚠ README.md / CLAUDE.md                      (not yet created; create at first feature)

Deferred TODOs: none
-->

# ssHelper Constitution

ssHelper is a local application that helps researchers build systematic review search
strategies. It has three functions: (1) expanding concept synonyms, optionally with AI
assistance; (2) validating a PubMed strategy against a set of known relevant studies entered by
DOI or link; and (3) translating a strategy into the syntax of other bibliographic databases,
in the spirit of the Polyglot Search Translator (SR-Accelerator). It assists the searcher; it
does not replace the searcher's or an information specialist's judgment.

## Core Principles

### I. Researcher Owns the Strategy

- The application MUST NOT silently change a search strategy. Synonym suggestions,
  translations, and fixes are proposals that the researcher accepts, edits, or rejects.
- Suggested terms MUST be visibly distinct from terms the researcher entered until accepted.
- Translated strategies MUST be presented as drafts that require review before use, with a
  visible notice that controlled vocabulary does not map one-to-one between databases.

Rationale: Search strategies are reported and peer reviewed (PRISMA-S, PRESS). The researcher
stays accountable for every term and operator.

### II. Local-First, No Account Required

- The current version MUST run entirely on the researcher's machine with no sign-in, account,
  or project server.
- Projects (strategies, synonym lists, validation study sets, results) MUST be stored locally
  and MUST be exportable to and importable from a file the researcher controls.
- Outbound network calls are limited to: bibliographic APIs needed for a function the
  researcher invoked (e.g., NCBI E-utilities, DOI resolution) and the AI provider the
  researcher configured. No analytics or telemetry.
- Storage MUST sit behind an adapter interface so a future hosted version (accounts,
  Supabase, Vercel) can be added without rewriting core logic. Hosted features are out of
  scope until a constitution amendment.

Rationale: Low barrier to use now, with a clear path to a web version later.

### III. AI Is Optional and Bring-Your-Own-Key

- Every function MUST be fully usable without an API key. AI synonym expansion is an
  enhancement layered on a working manual workflow.
- API keys MUST be stored only locally, sent only to the provider they belong to, and MUST
  NOT appear in logs, exports, project files, or error messages.
- AI output MUST be treated as unverified suggestions (Principle I). Where feasible, suggested
  terms SHOULD be checked against a real source (e.g., MeSH lookup, PubMed hit count) before
  being shown as validated.
- AI MUST NOT be used for strategy validation or syntax translation; those paths stay
  deterministic (Principles IV, V).

Rationale: Many researchers have no key or cannot share data with AI providers.

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
  NCBI key), `tool` and `email` parameters, and backoff on errors.

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
  counts, and validation results.
- Researcher-initiated deletion of a project or of all local data is always permitted.

Rationale: Search development is iterative and must be reported transparently.

### VII. Modularity

- Strategy parsing, database dialects, synonym providers, PubMed client, identifier
  resolution, storage, and UI MUST be independent components with explicit interfaces.
- Each database dialect MUST be a self-contained module so new databases can be added
  without changing the parser or other dialects.
- The core (parser, translator, validator) MUST run without the UI and without any AI provider.

Rationale: Databases and providers change independently; each piece must be testable alone.

### VIII. No Unjustified Complexity

- Prefer the simplest approach that works locally: no backend server unless a browser-only
  approach is blocked (e.g., by CORS), and then only a minimal local proxy.
- New dependencies, services, or AI features MUST be justified in the feature plan's
  Complexity Tracking table.

Rationale: A small local tool must stay easy to install, run, and maintain.

## Functional Scope and Domain Constraints

- Function 1, synonym expansion: manual term entry per concept always available; optional
  sources include MeSH/entry terms via NCBI and AI providers with a researcher-supplied key.
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
- Tests MUST verify API keys never appear in exports, project files, or logs.
- Tests MUST verify the app works end to end with no AI key configured.

## Governance

- This constitution supersedes other project practices. Where README, CLAUDE.md, or other
  guidance conflicts, this document wins until amended.
- Amendments require: a written rationale, an updated Sync Impact Report, propagation to
  dependent templates, and a version bump.
- Versioning follows semantic versioning:
  - MAJOR: removal or backward-incompatible redefinition of a principle (e.g., adding required
    accounts or a hosted backend).
  - MINOR: new principle or section, or materially expanded guidance.
  - PATCH: clarifications, wording, typo fixes.
- Compliance review: every spec, plan, task list, and code review MUST check alignment with
  these principles. Violations MUST be fixed or justified in Complexity Tracking.

**Version**: 1.0.0 | **Ratified**: 2026-09-16 | **Last Amended**: 2026-09-16
