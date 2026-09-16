# Contract: Term Rules and Query Builder (`src/core`)

Pure functions. No I/O. Deterministic. Every table row is a required fixture test.

## `commitTerm(raw: string): string | null`

1. Trim `raw`. If empty, return `null`.
2. Split a trailing field tag: text matching `^(.*?)(\[[^\]]+\])$` gives `body` and `tag`;
   otherwise `body = text`, `tag = ""`. Trim `body`.
3. If `body` is already wrapped in double quotes, return `body + tag`.
4. If `body` contains a space, return `"` + `body` + `"` + `tag`.
5. Otherwise return `body + tag`.

| Input | Output |
|-------|--------|
| `heart failure` | `"heart failure"` |
| `  diabetes  ` | `diabetes` |
| `"heart failure"` | `"heart failure"` |
| `heart failure[tiab]` | `"heart failure"[tiab]` |
| `Heart Failure[Mesh]` | `"Heart Failure"[Mesh]` |
| `cardio*` | `cardio*` |
| `sglt2[tiab]` | `sglt2[tiab]` |
| `   ` | `null` |

## `unquoteTerm(text: string): string`

Removes the wrapping quotes of the body and keeps the tag. No other change.

| Input | Output |
|-------|--------|
| `"heart failure"` | `heart failure` |
| `"heart failure"[tiab]` | `heart failure[tiab]` |
| `diabetes` | `diabetes` |

## `validateTerm(text: string): Issue | null`

Returns an issue when parentheses are unbalanced or the number of `"` is odd.

| Input | Result |
|-------|--------|
| `(heart` | `unbalanced_parentheses` |
| `"heart failure` | `unbalanced_quotes` |
| `"heart failure"` | null |

## `buildQuery(arms: string[][]): string | null`

- Drop arms with no terms. If none remain, return `null`.
- Each arm: `"(" + terms.join(" OR ") + ")"`. Join arms with `" AND "`.

| Arms | Output |
|------|--------|
| `[["\"heart failure\"","\"cardiac failure\""], [], ["\"sglt2 inhibitors\""]]` | `("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")` |
| `[[], ["diabetes"], []]` | `(diabetes)` |
| `[[], [], []]` | `null` |

## `withMetaAnalysisArm(query: string): string`

Returns `query + ' AND ("meta-analysis")'`.

| Input | Output |
|-------|--------|
| `(diabetes)` | `(diabetes) AND ("meta-analysis")` |
