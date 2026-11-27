# 05 — Negative security tests

## Live JWT / Storage

| Test | Suite | Result |
| --- | --- | --- |
| Ordinary user cannot list queue | M2B.4 | PASS |
| Ordinary user cannot approve/reject | M2B.4 | PASS |
| Player cannot mint reviewer evidence URL | M2B.4 | PASS |
| Unauthorized evidence URL denied | M2B.4 | PASS |
| Player A cannot download Player B object | M2B.3C | PASS |
| Player B cannot overwrite/delete A | M2B.3C | PASS |
| Cross-account evidence metadata denied | M2B.3C | PASS |
| Anonymous Storage denied | M2B.3C | PASS |
| Team-owner context ≠ member evidence | M2B.3C | PASS |
| Self-approve forbidden | M2B.4 | PASS |
| Duplicate decisions rejected | M2B.4 | PASS |
| Audit forge denied | M2B.4 | PASS |
| Public reader hides BGMI ID / internals | M2B.4 | PASS |
| Pending ≠ public badge | M2B.4 | PASS |
| G1 projection = 12 fields | unit + M2B.4 | PASS |

## UI / route

| Test | Result |
| --- | --- |
| Anon moderation review: no Approve/Reject | Playwright PASS |
| Anon settings: no verification upload | Playwright PASS |
| Anon moderation index: no BGMI queue link (session gate) | Playwright PASS |
| Client cannot UPDATE review status | RPC/GUC guards (M2B.4 design) PASS |

## Totals this acceptance

- M2B.4 integration: **8/8**
- M2B.3C storage: **6/6**
- Targeted unit: **20/20**
- Playwright P15-E2E: **3/3**
