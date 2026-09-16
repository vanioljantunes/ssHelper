# Data Model: PubMed Arm-Based Search and Result History

All entities are plain TypeScript types in `src/core`. Persistence shapes are in
[contracts/storage.md](./contracts/storage.md).

## Term

| Field | Type | Rules |
|-------|------|-------|
| id | string (UUID) | Unique within the strategy; stable across edits |
| text | string | Committed display text, exactly what is sent to PubMed; trimmed; never empty |

- Created by committing input (Enter, or Search auto-commit). Blank input creates nothing.
- Quoted state is derived from `text` (body wrapped in `"` before any field tag), not stored
  separately, so display and query cannot disagree.
- Transitions: `commit(raw)` applies the quote rule; `unquote(term)` removes quotes only;
  `edit(term, raw)` re-applies the quote rule; committing empty text on an existing term removes
  it.

## Arm

| Field | Type | Rules |
|-------|------|-------|
| id | string (UUID) | Unique within the strategy |
| terms | Term[] | Ordered; may be empty |
| pending | string | Uncommitted text in the arm's input box; not in the query until committed |

- An arm is empty when `terms` is empty after committing `pending`.

## Strategy

| Field | Type | Rules |
|-------|------|-------|
| arms | Arm[] | Ordered; length >= 1; default 3 empty arms |

- `removeArm` on the last remaining arm replaces it with one empty arm.
- `buildQuery(strategy)`: non-empty arms, each `(t1 OR t2 ...)`, joined by ` AND `. Returns
  `null` when all arms are empty (Search disabled).
- `withMetaAnalysisArm(query)`: `query + ' AND ("meta-analysis")'`.
- `validate(strategy)`: issues for terms with unbalanced parentheses or quotation marks
  (research R3). Any issue blocks Search.

## CountOutcome

Discriminated union:

| status | Fields | Meaning |
|--------|--------|---------|
| `ok` | count: number (>= 0), queryTranslation: string, warnings: string[] | PubMed answered |
| `error` | kind: `rate_limited` \| `network` \| `http` \| `invalid_response`, message: string | Failed; never displayed as a number |

## SearchRun (history row)

| Field | Type | Rules |
|-------|------|-------|
| id | string (UUID) | Unique |
| createdAt | string (ISO 8601 UTC) | Time Search was pressed; displayed in local time to the minute |
| arms | { terms: string[] }[] | Snapshot of committed terms per arm, including empty arms, for Load |
| query | string | Exact strategy query sent |
| metaQuery | string | Exact query with the meta-analysis arm |
| result | CountOutcome | Strategy count |
| metaResult | CountOutcome | Count with meta-analysis arm |

- Saved when at least one of `result` / `metaResult` is `ok`. If both are `error`, no row is
  saved and the error is shown (spec edge case).
- Immutable after save. Only deletion (single or clear all) removes it.
- Displayed by `createdAt` descending.

## Draft

| Field | Type | Rules |
|-------|------|-------|
| arms | { terms: string[]; pending: string }[] | Current editor state, saved on every change |

- Restored on page load; if absent or unreadable, the default 3 empty arms are used.

## Example (synthetic)

```json
{
  "id": "5d0c9a3e-2b1f-4a7e-9a55-1c2d3e4f5a6b",
  "createdAt": "2026-09-16T17:05:00.000Z",
  "arms": [
    { "terms": ["\"heart failure\"", "\"cardiac failure\""] },
    { "terms": [] },
    { "terms": ["\"sglt2 inhibitors\""] }
  ],
  "query": "(\"heart failure\" OR \"cardiac failure\") AND (\"sglt2 inhibitors\")",
  "metaQuery": "(\"heart failure\" OR \"cardiac failure\") AND (\"sglt2 inhibitors\") AND (\"meta-analysis\")",
  "result": { "status": "ok", "count": 1234, "queryTranslation": "...", "warnings": [] },
  "metaResult": { "status": "error", "kind": "rate_limited", "message": "PubMed is busy. Try again shortly." }
}
```
