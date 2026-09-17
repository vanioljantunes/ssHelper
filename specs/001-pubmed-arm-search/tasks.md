---

description: "Task list for 001 PubMed arm-based search and result history"
---

# Tasks: PubMed Arm-Based Search and Result History

**Input**: Design documents from `/specs/001-pubmed-arm-search/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The constitution (Development Workflow & Quality Gates) requires fixture
tests for query rules, recorded-response tests for the PubMed client, and opt-in live tests.
Write each test task before its implementation task and confirm it fails first.

**Organization**: Tasks are grouped by user story so each story can be built and tested alone.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1, US2)
- Paths are relative to the repository root (single frontend project, see plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Initialize Vite React TypeScript project at repository root: `package.json` (name `sshelper`, private, scripts `dev`, `build`, `preview`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `test:watch`, `test:e2e` = `playwright test`, `test:live` = `vitest run tests/live`), `index.html`, `src/main.tsx`, `vite.config.ts`; dependencies react@19, react-dom@19; dev dependencies vite@6, @vitejs/plugin-react, typescript@5
- [X] T002 Configure strict TypeScript in `tsconfig.json` (strict, noUncheckedIndexedAccess, noImplicitOverride, jsx react-jsx, types for vite/client and vitest/globals)
- [X] T003 [P] Configure Vitest with jsdom and React Testing Library: add dev dependencies vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom; set `test` block in `vite.config.ts` (environment jsdom, setupFiles `tests/setup.ts`, exclude `tests/e2e/**` and `tests/live/**` from default run); create `tests/setup.ts` importing jest-dom matchers
- [X] T004 [P] Configure Playwright in `playwright.config.ts` (Chromium only, webServer `npm run dev` on port 5173, testDir `tests/e2e`); add @playwright/test dev dependency
- [X] T005 [P] Add ESLint and Prettier config in `eslint.config.js` and `.prettierrc` (typescript-eslint, react-hooks rules; for `src/core/**`: `no-restricted-imports` forbidding `react`, `src/ui`, `src/pubmed`, `src/storage`, and `no-restricted-globals` forbidding `fetch`, `localStorage`, `window`, `document`)
- [X] T006 [P] Create `.gitignore` (node_modules, dist, .env*, !.env.example, playwright-report, test-results), `.env.example` with `VITE_NCBI_CONTACT_EMAIL=` and a comment that it is required and needs no NCBI account, and `.env.local` with the operator's contact address (never committed); in `vite.config.ts` use `loadEnv` and throw a clear error when `VITE_NCBI_CONTACT_EMAIL` is missing for `serve` and `build` (Constitution Principle IV). No `vercel.json` in Phase A
- [X] T007 [P] Create folder skeleton: `src/core/`, `src/pubmed/`, `src/storage/`, `src/i18n/`, `src/ui/`, `tests/unit/`, `tests/contract/`, `tests/component/`, `tests/e2e/`, `tests/live/`, `tests/fixtures/pubmed/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, string catalog, fixtures, and app shell used by both stories

**CRITICAL**: No user story work begins until this phase is complete

- [X] T008 [P] Define core types in `src/core/types.ts`: `Term { id; text }`, `Arm { id; terms: Term[]; pending: string }`, `Strategy { arms: Arm[] }`, `Issue { armId; termId?; kind: 'unbalanced_parentheses' | 'unbalanced_quotes' }`, `CountOutcome` union (`ok` with count, queryTranslation, warnings; `error` with kind `rate_limited | network | http | invalid_response` and message), `SearchRun { id; createdAt; arms: { terms: string[] }[]; query; metaQuery; result; metaResult }`, `Draft { arms: { terms: string[]; pending: string }[] }` per data-model.md
- [X] T009 [P] Create id helper `src/core/id.ts` exporting `newId()` using `crypto.randomUUID()`
- [X] T010 [P] Create English string catalog `src/i18n/en.ts` as a typed `const` object with every UI string from contracts/ui.md (title, purpose line, "Arm {n}", "Delete arm {n}", "AND", "OR", "Add arm", "Remove quotes", "Remove term", "Search", "Searching PubMed...", "Add at least one term.", issue messages, "Results", "Results + meta-analysis", "Error", error reason per kind, run-time notice (FR-017), history column headers, "Load", "Copy", "Copied", "Delete", "Clear history", confirmation texts, "No searches yet.", "History could not be saved in this browser."); export a `t` helper for `{n}` interpolation
- [X] T011 Create app shell `src/ui/App.tsx` with layout regions (header, arms editor, search panel, history) and a polite live region, rendered from `src/main.tsx`; base styles in `src/ui/app.css` (readable max width, wrapping rows, visible focus outlines, monospace query preview)
- [X] T012 [P] Record PubMed fixtures in `tests/fixtures/pubmed/`: `count-ok.json` (esearch JSON with count, querytranslation, translationset), `quoted-phrase-not-found.json` (count 0, `warninglist.quotedphrasesnotfound`, outputmessages "No items found."), `rate-limited.json` (synthetic, labelled in a sibling `README.md`: `{"error":"API rate limit exceeded","api-key":"...","count":"4","limit":"3"}`), `malformed.txt` (non-JSON body); capture ok and not-found bodies from the real API with `retmax=0` per research.md R2

**Checkpoint**: Foundation ready; user story phases can start

---

## Phase 3: User Story 1 - Build a strategy with arms and get the PubMed count (Priority: P1) MVP

**Goal**: Researcher builds arms of quoted or unquoted terms and gets both PubMed counts

**Independent Test**: Enter terms in two arms, press Search, and confirm both counts match PubMed's website for the displayed query and for the query with `AND ("meta-analysis")` (quickstart scenarios 1-7, 11-13)

### Tests for User Story 1 (write first, confirm failing)

- [X] T013 [P] [US1] Fixture tests for `commitTerm`, `unquoteTerm`, `validateTerm` covering every table row in contracts/query-builder.md in `tests/unit/term.test.ts`
- [X] T014 [P] [US1] Fixture tests for `buildQuery` and `withMetaAnalysisArm` (all table rows, plus determinism: same input twice gives identical output) in `tests/unit/query.test.ts`
- [X] T015 [P] [US1] Tests for strategy operations (default 3 empty arms; addArm appends empty arm; removeArm keeps order and terms; removing the last arm leaves one empty arm; add, edit, remove, unquote term; commit pending on all arms; duplicate terms in one arm are kept; validate returns issues) in `tests/unit/strategy.test.ts`
- [X] T016 [P] [US1] Throttle tests with fake timers (request starts spaced at least 350 ms; order preserved) in `tests/unit/throttle.test.ts`
- [X] T017 [P] [US1] Contract tests for `countQuery` with mocked `fetch` and T012 fixtures: URL params (db, encoded term, retmode json, retmax 0, tool ssHelper, email always present); ok mapping with warnings excluding "No items found."; 429 retried twice then `rate_limited`; 5xx retried then `http`; 404 no retry `http`; network error and 15 s timeout give `network`; malformed body gives `invalid_response`; never throws; in `tests/contract/pubmed-client.test.ts`
- [X] T018 [P] [US1] Tests for `runSearch` (commits pending text first; issues stop with no fetch; null query stops; counts query then metaQuery in order; both errors return failure with no run; one error still returns a run with that outcome as error; run has ISO `createdAt` and arm snapshot including empty arms) in `tests/unit/run.test.ts`
- [X] T019 [P] [US1] Component tests for term boxes per contracts/ui.md (Enter commits and quotes multi-word; single word unquoted; Enter on empty does nothing; clicking a quote mark unquotes without edit mode; clicking text enters edit mode; Enter re-applies rule; empty edit removes term; Escape cancels; x removes term and its OR; Backspace in empty input does nothing; OR labels not focusable) in `tests/component/TermBox.test.tsx`
- [X] T020 [P] [US1] Component tests for arms editor and search panel (3 arms and 2 AND labels on load; Add arm; deleting middle arm keeps one AND per gap; Search disabled with hint when all empty; Search disabled with issue message for `(heart`; pending text auto-committed on Search; loading state blocks duplicate run; counts with thousands separators; error shows "Error" and never a number; FR-017 notice visible) in `tests/component/ArmsEditor.test.tsx`

### Implementation for User Story 1

- [X] T021 [P] [US1] Implement `commitTerm`, `unquoteTerm`, `validateTerm` in `src/core/term.ts` per contracts/query-builder.md (trailing field tag split `^(.*?)(\[[^\]]+\])$`, no double quoting, odd quote count and unbalanced parentheses issues)
- [X] T022 [P] [US1] Implement `buildQuery` and `withMetaAnalysisArm` in `src/core/query.ts` (drop empty arms, `(t1 OR t2)`, join with ` AND `, null when none; append ` AND ("meta-analysis")`)
- [X] T023 [US1] Implement immutable strategy operations in `src/core/strategy.ts`: `createDefaultStrategy()` (3 empty arms), `addArm`, `removeArm` (never zero arms), `setPending`, `commitPending(armId)`, `commitAllPending`, `editTerm` (re-applies `commitTerm`; empty removes), `removeTerm`, `unquoteTermById`, `validateStrategy`, `toArmTerms(strategy): string[][]`, `toDraft`, `fromDraft` (depends on T021, T022)
- [X] T024 [P] [US1] Implement request throttle in `src/pubmed/throttle.ts`: single FIFO queue, at least 350 ms between request starts, `schedule<T>(fn): Promise<T>`, injectable clock for tests
- [X] T025 [US1] Implement `countQuery(query, signal?)` in `src/pubmed/client.ts` per contracts/pubmed-client.md: esearch URL with `import.meta.env.VITE_NCBI_CONTACT_EMAIL`, 15 s timeout via AbortController, retries 429 and 5xx after 1 s and 3 s, maps to `CountOutcome`, flattens `warninglist` and `errorlist`, messages from `src/i18n/en.ts`, never throws (depends on T024)
- [X] T026 [US1] Implement `runSearch(strategy, deps: { countQuery; now; newId })` in `src/core/run.ts` returning `{ strategy, issues }`, `{ strategy, run }`, or `{ strategy, failure }` per contracts/run.md; `countQuery` injected so core has no fetch (depends on T023)
- [X] T027 [P] [US1] Implement `TermBox` in `src/ui/TermBox.tsx`: quoted term renders each quotation mark as a button ("Remove quotes") and the body as a button that enters edit mode; edit input handles Enter and Escape; remove button "Remove term"; invalid outline
- [X] T028 [US1] Implement `ArmRow` in `src/ui/ArmRow.tsx`: header "Arm N" with "Delete arm N" button; wrapping row of TermBox items separated by non-focusable "OR" text; trailing input always present; Enter commits pending; empty Enter and Backspace do nothing; issue messages under the arm (depends on T027)
- [X] T029 [US1] Implement `ArmsEditor` in `src/ui/ArmsEditor.tsx`: arms with non-focusable "AND" labels between them and an "Add arm" button; state via props and callbacks from App (depends on T028)
- [X] T030 [US1] Implement `SearchPanel` in `src/ui/SearchPanel.tsx`: live query preview (monospace, wraps) from `buildQuery`; Search button states per contracts/ui.md; running indicator; strategy and meta-analysis results via `Intl.NumberFormat`; "Error" plus reason for errors; PubMed warnings list; FR-017 notice; results announced in the live region
- [X] T031 [US1] Wire US1 in `src/ui/App.tsx`: strategy state from `createDefaultStrategy()`, handlers passed to ArmsEditor, Search calls `runSearch` with real `countQuery`, last run shown in SearchPanel, concurrent runs blocked (depends on T025, T026, T029, T030)
- [X] T032 [US1] Playwright test for US1 with PubMed routed to fixtures (`page.route` on the eutils URL): quickstart scenarios 1-7 and 11-13 in `tests/e2e/us1-arms-search.spec.ts`

**Checkpoint**: User Story 1 works on its own (counts shown, nothing persisted yet)

---

## Phase 4: User Story 2 - Keep a history of searches (Priority: P2)

**Goal**: Every completed search becomes a persistent history row that can be loaded, copied, and deleted

**Independent Test**: Run three strategies, see three rows newest first with date and time to the minute, query, and both counts; reload and confirm rows and draft persist (quickstart scenarios 8-10, 14-15)

### Tests for User Story 2 (write first, confirm failing)

- [X] T033 [P] [US2] Storage tests in `tests/unit/localStore.test.ts`: `list` newest first; `add` rejects duplicate id and never overwrites; `remove`; `clear`; draft round trip; corrupt JSON and unknown `schemaVersion` return empty or null and copy the raw value to `<key>:corrupt`; `QuotaExceededError` and access errors return `{ ok: false, reason }`; two runs with identical query text are both stored; only `sshelper:v1:history`, `sshelper:v1:draft`, and `:corrupt` keys are written
- [X] T034 [P] [US2] Component tests for `HistoryTable` in `tests/component/HistoryTable.test.tsx`: column order; local date and time to the minute; formatted counts; error outcome shows "Error" with reason as accessible description; Copy writes `query` to `navigator.clipboard` and shows "Copied"; Load calls handler; Delete removes row; Clear history requires confirmation; empty state "No searches yet."

### Implementation for User Story 2

- [X] T035 [P] [US2] Define `HistoryStore`, `DraftStore`, `SaveResult` interfaces in `src/storage/types.ts` per contracts/storage.md
- [X] T036 [US2] Implement `createLocalHistoryStore(storage = window.localStorage)` and `createLocalDraftStore(storage = window.localStorage)` in `src/storage/localStore.ts` with `schemaVersion: 1`, safe reads, corrupt-value preservation, and caught write errors (depends on T035)
- [X] T037 [US2] Implement `HistoryTable` in `src/ui/HistoryTable.tsx` per contracts/ui.md (Date and time, Search strategy wrapping with full text, Results, Results + meta-analysis, Actions Load, Copy, Delete; Clear history with confirm dialog; empty state)
- [X] T038 [US2] Wire US2 in `src/ui/App.tsx`: create stores once; restore draft via `fromDraft` (fallback default strategy); save draft on every strategy change; after a run, `add` it and refresh the list; Load replaces strategy with the row's arms after confirmation when the current draft has terms; Delete and Clear call the store; show "History could not be saved in this browser." when a `SaveResult` is not ok (depends on T031, T036, T037)
- [X] T039 [US2] Playwright test for US2 with PubMed routed to fixtures: quickstart scenarios 8-10 and 14-15 including reload persistence and clipboard copy (clipboard permissions granted) in `tests/e2e/us2-history.spec.ts`

**Checkpoint**: User Stories 1 and 2 work independently and together

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Constitution-driven checks, docs, and release readiness

- [X] T040 [P] Opt-in live PubMed tests (skipped unless `LIVE_PUBMED=1`) in `tests/live/pubmed-live.test.ts`: (a) `countQuery` for `("heart failure") AND ("meta-analysis")` returns `ok` with count > 0; (b) a nonsense quoted phrase returns count 0 with a `quotedphrasesnotfound` warning; (c) SC-002: 20 fixed strategies from `tests/live/strategies.json` built with `buildQuery`, each count equals a direct esearch request for the same term; (d) SC-003: time 20 full runs (strategy + meta-analysis) through the throttle and assert the 95th percentile is under 5 s
- [X] T041 [P] Secret leak check script `scripts/check-bundle.mjs`: scan `dist/` after build with anchored patterns (`\bsk-[A-Za-z0-9_-]{20,}`, `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `api_key=[A-Za-z0-9]{16,}`) and fail if found; add `npm run check:bundle` (Constitution Principle II)
- [X] T042 [P] Accessibility pass on `src/ui/*.tsx`: keyboard-only walkthrough, visible focus, accessible names from contracts/ui.md, live region announcements; add `@axe-core/playwright` checks to `tests/e2e/us1-arms-search.spec.ts` and `tests/e2e/us2-history.spec.ts`
- [X] T043 [P] Review UI copy in `src/i18n/en.ts` against Constitution Principle I (counts described as PubMed results at run time; no claim the strategy is validated or complete); confirm no hardcoded user-facing strings remain in `src/ui/`
- [X] T044 [P] Create `README.md`: purpose, three planned functions, delivery phases (A local test now, B Vercel + Supabase next), development commands from quickstart.md, required `VITE_NCBI_CONTACT_EMAIL` in `.env.local`, NCBI usage policy note, link to constitution
- [X] T045 [P] Create `CLAUDE.md`: project context, stack, layering rule (`src/core` has no UI, network, or storage imports), commands, spec-kit workflow, commits and pushes inside this repository only
- [X] T046 Run full quickstart.md validation locally: `npm run typecheck`, `npm test`, `npm run build`, `npm run check:bundle`, `npm run test:e2e`, `LIVE_PUBMED=1 npm run test:live`, and manual scenarios 1-15 (including pasting 3 strategies into pubmed.ncbi.nlm.nih.gov to compare counts); record deviations in `specs/001-pubmed-arm-search/quickstart.md`
- [X] T047 [P] Component and unit tests for invalid terms (FR-020): `(heart` and `"heart failure` marked invalid with explanation and Search disabled, in `tests/component/ArmsEditor.test.tsx` and `tests/unit/term.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup; blocks both stories
- **US1 (Phase 3)**: Depends on Foundational
- **US2 (Phase 4)**: Depends on Foundational. T033-T037 can run in parallel with US1; wiring (T038) needs T031 because history rows come from US1 runs
- **Polish (Phase 5)**: Depends on US1 and US2

### Within User Story 1

- Tests T013-T020 before implementation
- T021, T022 -> T023 -> T026
- T024 -> T025
- T027 -> T028 -> T029
- T025, T026, T029, T030 -> T031 -> T032

### Within User Story 2

- Tests T033-T034 before implementation
- T035 -> T036
- T031, T036, T037 -> T038 -> T039

## Parallel Examples

### Setup

```text
T003 Vitest | T004 Playwright | T005 ESLint/Prettier | T006 gitignore/env/vercel | T007 folders
```

### Foundational

```text
T008 core types | T009 id helper | T010 string catalog | T012 PubMed fixtures
```

### User Story 1 tests

```text
T013 term | T014 query | T015 strategy | T016 throttle | T017 client | T018 run | T019 TermBox | T020 ArmsEditor
```

### User Story 1 implementation

```text
T021 term.ts | T022 query.ts | T024 throttle.ts | T027 TermBox.tsx
```

### User Story 2

```text
T033 storage tests | T034 HistoryTable tests | T035 storage types
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup and Phase 2 Foundational
2. Phase 3 US1: arms, quoting, both PubMed counts
3. Stop and validate locally with quickstart scenarios 1-7 and 11-13; compare counts with PubMed website

### Incremental Delivery

1. US2 history and persistence; validate scenarios 8-10 and 14-15
2. Polish: live smoke, bundle check, accessibility, docs
3. Next phase (Constitution Delivery Phase B): Vercel hosting and Supabase accounts replacing `src/storage/localStore.ts` behind the same interfaces

## Notes

- [P] tasks touch different files and have no incomplete dependencies
- Commit after each task or logical group, inside the ssHelper repository
- `src/core` stays free of React, fetch, and storage imports (enforced by T005 lint rule)
