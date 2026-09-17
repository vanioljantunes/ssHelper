# PubMed esearch fixtures

Recorded responses used by `tests/contract/pubmed-client.test.ts`.

| File | Source |
|------|--------|
| `count-ok.json` | Real response, 2026-09-16. `esearch.fcgi?db=pubmed&retmode=json&retmax=0&tool=ssHelper&term=(diabetes) AND ("meta-analysis")` |
| `quoted-phrase-not-found.json` | Real response, 2026-09-16. Same parameters with `term="zzqxunfoundphrase qqxz"` |
| `rate-limited.json` | SYNTHETIC. Written by hand to match the body NCBI documents for HTTP 429 (`{"error":"API rate limit exceeded", ...}`). The `api-key` value is a documentation IP address (RFC 5737), not a real key |
| `malformed.txt` | SYNTHETIC. Non-JSON body, used for the `invalid_response` path |

Counts in the real responses change as PubMed is updated; tests read the count from the file
instead of hardcoding it.
