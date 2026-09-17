# CLAUDE.md

Operating context for Claude Code sessions in the ssHelper repository.

## Project

ssHelper is a free public web app that helps researchers build systematic review search
strategies: synonym expansion, validation of a PubMed strategy against known studies, and
translation to other databases. The [constitution](.specify/memory/constitution.md) wins over
anything else, including this file.

Current state: feature 001 (PubMed arm-based search and result history) in Delivery Phase A,
a local test version with browser storage. Phase B adds Vercel hosting and Supabase accounts.

## Stack

- Vite 6, React 19, TypeScript strict. React is the only runtime dependency.
- Vitest with jsdom and React Testing Library; Playwright (Chromium) with axe checks.
- ESLint (typescript-eslint, react-hooks) and Prettier.

## Layering rule

```
src/core     pure TypeScript: term rules, query builder, strategy, run orchestration
src/pubmed   esearch client and request throttle
src/storage  HistoryStore and DraftStore interfaces plus the localStorage implementation
src/i18n     every user-facing string (en.ts)
src/ui       React components
```

- `src/core` must not import React, `src/ui`, `src/pubmed`, or `src/storage`, and must not use
  `fetch`, `localStorage`, `window`, or `document`. ESLint enforces this.
- Dependencies that do I/O are injected (for example `runSearch` receives `countQuery`).
- UI components read all visible text from `src/i18n/en.ts`. No hardcoded strings, no emojis.
- Storage is reached only through the interfaces in `src/storage/types.ts`; Supabase replaces
  the implementation in Phase B.

## Commands

```bash
npm run dev          # needs .env.local with VITE_NCBI_CONTACT_EMAIL
npm run typecheck
npm run lint
npm test
npm run test:e2e     # starts its own dev server on port 5183 (E2E_PORT)
LIVE_PUBMED=1 npm run test:live   # real PubMed, opt-in only
npm run build && npm run check:bundle
```

## Testing rules

- Write tests first and confirm they fail before implementing.
- Contract tables in `specs/<feature>/contracts/` are required fixtures.
- The PubMed client is tested against recorded responses in `tests/fixtures/pubmed/` (do not
  reformat them). Live API tests stay opt-in behind `LIVE_PUBMED=1`.

## Spec-kit workflow

Features follow `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`,
`/speckit-analyze`, then `/speckit-implement`. Artifacts live in `specs/<NNN-name>/`. Mark tasks
`[X]` in `tasks.md` as they finish and record any deviation under "Deviations" in that feature's
`quickstart.md`.

## Git

- This is its own repository (`vanioljantunes/ssHelper`, branch `main`). It sits inside the
  claudeOS folder, which ignores it: run git commands inside this directory only and never
  commit to claudeOS.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Never commit `.env.local` or any other `.env*` file except `.env.example`.
