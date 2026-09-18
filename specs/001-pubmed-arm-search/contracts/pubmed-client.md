# Contract: PubMed Count Client (`src/pubmed`)

## `countQuery(query: string, signal?: AbortSignal): Promise<CountOutcome>`

Never throws. Always resolves to a `CountOutcome` (see data-model.md).

### Request

`GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`

| Param | Value |
|-------|-------|
| db | `pubmed` |
| term | query, URL-encoded |
| retmode | `json` |
| retmax | `0` |
| tool | `ssHelper` |
| email | The visitor's contact email (FR-025), read at request time; blank gives `error/no_email` and no request |

All calls pass through the throttle queue: at least 350 ms between request starts, 15 s timeout.

### Response mapping

| Condition | Outcome |
|-----------|---------|
| 200, `esearchresult.count` parses as integer >= 0 | `ok` with `count`, `queryTranslation` (`querytranslation` or `""`), `warnings` (flattened `warninglist` and `errorlist` values, excluding `"No items found."`) |
| 429, or 200 JSON with top-level `error` mentioning rate limit | retry up to 2 times (1 s, 3 s), then `error/rate_limited` |
| 5xx | retry up to 2 times, then `error/http` |
| Other non-200 | `error/http` (no retry) |
| Network failure or timeout | `error/network` |
| 200 but body not JSON or `count` missing | `error/invalid_response` |
| Contact email blank (no request sent) | `error/no_email` |

### Recorded fixtures (`tests/fixtures/pubmed/`)

| File | Content |
|------|---------|
| `count-ok.json` | Normal response with count and translation set |
| `quoted-phrase-not-found.json` | Count 0 with `quotedphrasesnotfound` warning |
| `rate-limited.json` | Synthetic, matching NCBI's documented body `{"error":"API rate limit exceeded", ...}`, served with HTTP 429 |
| `malformed.txt` | Non-JSON body |


Search orchestration (`runSearch`) is specified in [run.md](./run.md).
