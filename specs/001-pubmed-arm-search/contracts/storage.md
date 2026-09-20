# Contract: Storage (`src/storage`)

Interfaces are the seam for the accounts feature (Supabase). UI depends only on these.

## Interfaces

```ts
interface HistoryStore {
  list(): SearchRun[];            // newest first
  add(run: SearchRun): SaveResult;
  attachStudies(id: string, studies: RunStudies): SaveResult;  // FR-030
  remove(id: string): SaveResult;
  clear(): SaveResult;
}

interface DraftStore {
  load(): Draft | null;
  save(draft: Draft): SaveResult;
}

type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };
```

## localStorage implementation

| Key | Value |
|-----|-------|
| `sshelper:v1:history` | `{ "schemaVersion": 1, "runs": SearchRun[] }` |
| `sshelper:v1:draft` | `{ "schemaVersion": 1, "arms": [{ "terms": string[], "pending": string }] }` |
| `sshelper:v1:settings` | `{ "schemaVersion": 1, "contactEmail": string }` (FR-025, `SettingsStore`) |

Rules:

- Reads never throw. Unparseable data or unknown `schemaVersion` returns empty history or a null
  draft, and the raw value is copied to `<key>:corrupt` for recovery instead of being deleted.
- Writes catch `QuotaExceededError` and access errors and return `{ ok: false }`; the UI shows
  "History could not be saved in this browser."
- `add` never replaces an existing run; duplicate ids are rejected.
- `attachStudies` sets `studies` on a saved run and returns `{ ok: false, reason: 'unavailable' }`
  for an unknown id; it never adds a run. `SearchRun.studies` is optional, so history saved before
  FR-030 stays readable.
- No secrets are ever written.
- Accounts feature: a Supabase implementation of the same interfaces, plus a one-time import of
  `sshelper:v1:history` into the signed-in account.
