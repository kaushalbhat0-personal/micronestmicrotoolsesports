# 07 — Test Results (P14-D3)

| Lane | Command / scope | Result |
| --- | --- | --- |
| Teams unit | `vitest` `src/features/teams` + `src/app/teams` + `src/app/workspace/teams` | **167 passed** |
| Typecheck | `npm run typecheck` | **PASS** |
| Lint | `npm run lint` | **PASS** |
| Production build | `npm run build` (Next 16.4.6) | **PASS** (`BUILD_EXIT=0`) |
| Static SQL security | Retargeted `team-security-boundary.test.ts` + application deferred assert | **PASS** |
| Runtime JWT/RLS | — | **PENDING / BLOCKED** |
| E2E mutating teams | — | Not run (would require writes / live DB) |

## Retarget notes

- Historical D1.5.1/D1.6.1 SQL path tests now assert P14 migrations + archival absence.
- Component tests updated for gated wired forms (no fake “unavailable” disabled button requirement).
