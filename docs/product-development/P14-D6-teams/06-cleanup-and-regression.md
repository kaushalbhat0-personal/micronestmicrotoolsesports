# 06 — Cleanup and Regression (P14-D6)

## Cleanup

| Artifact | Remaining |
| --- | --- |
| `p14d6.*` auth users | **0** |
| `p14d6-*` teams / members / audits | **0** |
| `app_users` | **0** |
| Audit trigger | re-enabled |

No real-user data touched.

## Regression

| Check | Result |
| --- | --- |
| Vitest teams + player-profile | **377 passed** (36 files) |
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run lint` | **PASS** (exit 0) |
| `npm run build` | **PASS** (exit 0) |
| Playwright Teams writes | **N/A** (no suite) |
| G1 player directory RPC smoke | **PASS** (during app battery) |
| Other write switches | remain **false** |
| Staged legacy renames | ~1298 preserved |
