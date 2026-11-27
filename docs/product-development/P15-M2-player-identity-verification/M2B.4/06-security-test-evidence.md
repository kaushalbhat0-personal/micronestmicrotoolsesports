# 06 — Security test evidence

## Unit / static

| Suite | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` (excludes `*.integration.test.ts`) | **1090 passed** |
| `bgmi-ownership-review.test.ts` | PASS (deny queue, self signed-URL ban, mint after authz, ID mismatch mapping, projection freeze) |
| Moderation route audits | Updated to carve out intentional `bgmi-ownership/` while P10 shells stay gate-closed |

## Live JWT integration (`G1_TEST_MODE=m2b4`)

`bgmi-ownership-review.integration.test.ts` — **8/8 passed**

| Case | Result |
| --- | --- |
| Ordinary user cannot list queue | PASS |
| Ordinary user cannot approve/reject | PASS |
| Player cannot queue / mint reviewer URL | PASS |
| Reviewer mint 60s URL; unauthorized denied | PASS |
| Ordinary user cannot forge `admin_audit_logs` | PASS |
| Pending → no public badge; projection 12 fields | PASS |
| ID mismatch flags case; approve + duplicate reject; public badge; ID change clears badge | PASS |
| Reviewer cannot approve own case | PASS |

## Prior Storage boundary (regression)

`G1_TEST_MODE=m2b3c` two-JWT suite still **6/6** when run in player-profile test collect.

## Build / E2E

| Gate | Result |
| --- | --- |
| `npm run build` | PASS (route `/workspace/moderation/bgmi-ownership` present) |
| Playwright `p15m2b4-bgmi-review.spec.ts` | PASS (anon denied approve controls) |
| Playwright `p15m2b3c-verification-settings.spec.ts` | PASS |

## Explicit confirmations

- No service-role used as a stand-in for ordinary player authorization in boundary tests.
- Signed URL query strings not logged.
