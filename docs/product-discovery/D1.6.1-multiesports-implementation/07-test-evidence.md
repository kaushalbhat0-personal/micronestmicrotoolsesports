# 07 — Test Evidence

Run: `npm test` (unit; integration excluded). Result: **35 files / 348 tests
PASS** (335 prior + 13 new: 8 multititle-contract + 5 insert-boundary).
`npm run typecheck`: PASS. `npm run lint`: PASS. `npm run build`: PASS
(verified this phase; 8 routes, no env-gated failures).

## Counts by execution level

| Level | Tests | What they prove |
|---|---|---|
| Pure-unit | 18 (multititle) + 335 existing − static | BGMI freeze, tri-state gating, format/activation split, vocab isolation; all G1/domain behavior unchanged |
| Static SQL-text | 9 (insert-boundary) + 27 (D1.5.1 files) | 000004 nullness + additive-only indexes; prior remediations intact |
| PostgreSQL/RLS runtime | 0 | BLOCKED — replay RT-01…RT-18 + RT-04b require an approved disposable environment (D1.5.2 `04`) |

## G1 regression evidence

No G1 source, migration, RPC, grant, RLS, or storage object touched (000004
references only D1 tables/policies). All G1 suites green unmodified; frozen
12-column projection and `game_user_id` protections intact; build output
unchanged (8 routes).
