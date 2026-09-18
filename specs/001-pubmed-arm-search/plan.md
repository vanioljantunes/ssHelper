# Implementation Plan: PubMed Arm-Based Search and Result History

**Branch**: `001-pubmed-arm-search` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-pubmed-arm-search/spec.md`

## Summary

A single-page web app where researchers build a PubMed strategy as arms (AND between arms, OR
between term boxes, automatic quoting of multi-word terms). Pressing Search sends two queries
to NCBI E-utilities `esearch` directly from the browser: the strategy, and the strategy with an
extra `("meta-analysis")` arm. Both counts, PubMed warnings, and a snapshot of the arms are
saved as a history row in browser storage. Rows can be loaded back, copied, and deleted.

Delivery: Constitution Phase A (local test version, run with the Vite dev server or local
preview). Hosting on Vercel with Supabase accounts is Phase B, a later feature.

Technical approach: Vite + React + TypeScript single-page app. Pure TypeScript core
(`src/core`) holds term quoting, query building, and run rules with no UI or network
dependency. A small PubMed client (`src/pubmed`) wraps `esearch` with throttling and typed
errors. A storage adapter (`src/storage`) uses `localStorage` now and is the seam for Supabase
in the accounts feature.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node 20+ for tooling

**Primary Dependencies**: React 19, Vite 6. No UI kit, no state library, no i18n library
(see research.md R4, R6).

**Storage**: Browser `localStorage` behind `HistoryStore` / `DraftStore` interfaces; versioned
JSON schema (see data-model.md). Temporary until the accounts feature.

**Testing**: Vitest (core, client with recorded responses, storage), React Testing Library
(components), Playwright (end-to-end flows with PubMed mocked; one opt-in live smoke test).

**Target Platform**: Current evergreen browsers (Chrome, Edge, Firefox, Safari), desktop first,
usable at tablet width. Runs locally (`npm run dev` / `npm run preview`); no hosting in this
feature.

**Project Type**: Web application, frontend only (no backend in this feature).

**Performance Goals**: Both counts shown within 5 s for 95% of runs (SC-003); term commit and
arm edits feel instant (under 50 ms).

**Constraints**: NCBI policy of 3 requests/s per IP without key; `tool` and `email` params on
every call (the visitor enters the contact email at runtime, FR-025; no request without it); no secrets in client; no telemetry; UI text in a translatable catalog (FR-018).

**Scale/Scope**: One page, one user per browser, history up to about 1,000 rows (well under
`localStorage` limits; see research.md R5).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Source: `.specify/memory/constitution.md` (v2.2.0). Mark each gate PASS, N/A, or VIOLATION.
Violations MUST be justified in Complexity Tracking.

- [x] **I. Researcher owns strategy**: PASS. The only automatic change is quoting multi-word
  terms, which the researcher requested, is visible in the box, and is reversible with one
  click (FR-005a/b). What is shown is what is sent (FR-005e).
- [x] **II. Hosted, private by default**: PASS for Delivery Phase A (local test version). Accounts,
  RLS, account deletion, and file export apply from Phase B. No server secrets exist; storage
  sits behind interfaces for the Supabase move.
- [x] **III. Free core, AI deferred**: PASS. No AI, no user keys, free.
- [x] **IV. Real PubMed evidence**: PASS for counts. Counts come from `esearch`; errors never
  shown as numbers; query text, timestamp, counts, and PubMed warnings recorded; calls
  throttled; `tool` and `email` always sent (visitor contact email required before any request, FR-025). Found / Not found / Unresolved belongs to the later
  study-check feature (N/A here).
- [x] **V. Deterministic translation**: N/A (no translation). Query builder is deterministic and
  fixture-tested.
- [x] **VI. Saved work**: PASS for Phase A. Runs appended, never overwritten; strategies
  reloadable; per-row copy (file export required from Phase B).
- [x] **VII. Modularity**: PASS. `core` (no UI, no network), `pubmed` client, `storage` adapter,
  and `ui` are separate; storage interface is ready for Supabase.
- [x] **VIII. Simplicity**: PASS. Static Vite app, no backend, no extra services; the only runtime
  dependency is React.

**Post-design re-check (after Phase 1)**: Unchanged. Design adds no server, secrets, or
services. Phase A scope confirmed; no deviations remain.

## Project Structure

### Documentation (this feature)

```text
specs/001-pubmed-arm-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── query-builder.md
│   ├── pubmed-client.md
│   ├── run.md
│   ├── storage.md
│   └── ui.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
index.html
package.json
vite.config.ts
tsconfig.json
README.md
CLAUDE.md
src/
├── core/                # pure TS: no React, no fetch, no storage
│   ├── term.ts          # commit, quote, unquote rules
│   ├── strategy.ts      # Arm and Strategy types; add/remove arm and term
│   ├── query.ts         # buildQuery, withMetaAnalysisArm
│   └── run.ts           # SearchRun creation from two count outcomes
├── pubmed/
│   ├── client.ts        # esearch count call, response and error mapping
│   └── throttle.ts      # request queue, max 3 req/s, backoff on 429
├── storage/
│   ├── types.ts         # HistoryStore, DraftStore interfaces
│   └── localStore.ts    # localStorage implementation, schema version, migration
├── i18n/
│   └── en.ts            # all UI strings (FR-018)
├── ui/
│   ├── App.tsx
│   ├── ArmsEditor.tsx
│   ├── ArmRow.tsx
│   ├── TermBox.tsx
│   ├── SearchPanel.tsx  # query preview, Search button, counts, notice (FR-017)
│   └── HistoryTable.tsx
└── main.tsx

tests/
├── unit/                # core, throttle, storage
├── contract/            # pubmed client against recorded fixtures
├── component/           # React Testing Library: TermBox, ArmsEditor, HistoryTable
├── e2e/                 # Playwright, PubMed mocked; live smoke opt-in
└── fixtures/pubmed/     # recorded esearch JSON responses
```

**Structure Decision**: One frontend project at the repository root. Layered folders enforce
Principle VII: `core` imports nothing from `ui`, `pubmed`, or `storage`; `ui` talks to storage
and PubMed through interfaces. A backend folder appears only with the accounts feature.
README.md and CLAUDE.md are created in this feature (constitution follow-up).

## Complexity Tracking

No constitution violations for Phase A (constitution v2.2.0).

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| PubMed called from the browser, not a server | No server needed in Phase A; NCBI allows browser calls | A proxy needs a shared-quota queue and a secret NCBI key with no benefit for count-only queries |
