# 01 — Migration Cutover Final (P14-D3)

## Preflight (recorded)

| Item | Value |
| --- | --- |
| Branch | `new-platform` |
| HEAD | `376df8f651f3142dcaacb2ddbcbf269b38196040` |
| Staged legacy renames | **1299** preserved |
| Supabase MCP this session | **Unavailable** — live ledger not freshly checked |
| Project target | `knniommcyyhbyiwljisk` only (LMS never accessed) |
| Remote apply | **Not performed** |

## Final active chain (23 files)

See `migration-manifest.json`.

Order summary:

1. Foundation + G1 (`…01`–`…09`)
2. D1 admin foundation `20261112000001`
3. **P14 F-A01** `20261112000002_p14_admin_superadmin_active_gate.sql`
4. P9 (`…05`–`…06`)
5. P11 (`…01`–`…03`)
6. P13 (`…04`–`…05`)
7. **P14 Teams** `20261114000001`–`00005`

## Archived (unchanged location from D2)

D1 teams `02`/`03`/`04` remain under `docs/product-development/P14-D2-teams/archived-migrations/d1-teams/`.

## Future `db push` scope (not executed)

Any future push would include all unapplied active-chain files after G1 ledger repair — including new P14 admin + Teams migrations. Owner authorization required separately.
