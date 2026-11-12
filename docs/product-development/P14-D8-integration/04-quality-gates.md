# 04 — Quality Gates (P14-D8)

## Commands / results

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test` (unit) | PASS — **99 files / 1003 tests** |
| Teams suite | Included in unit pass (87+ teams-related earlier; full suite green) |
| G1 / player tests | Included in unit pass (`player-profile`, `players/routes`) |
| `npm run lint` | PASS |
| `npm run build` | PASS — includes `/teams`, `/teams/new`, `/login`, `/logout`, workspace teams routes |
| Playwright vs preview | **Not safely executable** — Vercel SSO blocks unauthenticated browser; 8 failures / 1 pass (SSO wall). Specs still integrated for CI/local. |
| Migration ledger | **24** files; matches remote ledger from D7 |
| Feature switches | Teams `true`; organizer/tournament/moderation/news `false` |
| Secret scan | `.env` ignored; no committed JWT/private keys; service role only in server/test code via `process.env` |
| LMS exclusion | No LMS credentials; docs warn against `flhllvzzbtkfrcrajicq` |

## Fix applied for gates

`admin-boundary.test.ts` updated to assert active `20261112000002_p14_admin_superadmin_active_gate.sql` and assert archived `20261112000003` is absent — required after P14 cutover.

## Switches (unchanged)

```
WORKSPACE_WRITES_ENABLED = true
ORGANIZER_WRITES_ENABLED = false
TOURNAMENT_WRITES_ENABLED = false
MODERATION_WRITES_ENABLED = false
NEWS_WRITES_ENABLED = false
```
