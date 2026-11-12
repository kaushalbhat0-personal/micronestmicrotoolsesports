# Archived D1 Teams Migrations (P14-D2 / A6)

These files were **removed from** `supabase/migrations/` so they are **not** part of the active apply chain.

They are preserved here as historical design evidence only.

| File | SHA-256 (matches P13-C0 manifest) |
| --- | --- |
| `20261112000002_d1_teams_discovery.sql` | `2f4e0ac6686f620d3370532dfe0c02d4632cd5fc5288b8d083a92b034c37e79d` |
| `20261112000003_d1_security_remediation.sql` | `5209c028f2091da643fbfe441f7f2b5357c943d9d625a84a807e0b9e48d741d8` |
| `20261112000004_d1_insert_boundary_indexes.sql` | `554ed952c2c16267aa2e25e8d90c6b3faa2f0b12979510190071b7554b0344c7` |

**Do not** move them back into `supabase/migrations/` without an explicit owner decision.  
Teams requirements are reimplemented via the clean P14 migration set (see `../03-migration-cutover.md` and `../04-schema-and-rpc-contract.md`).

**Side effect:** `000003` also contained admin F-A01 (`is_super_admin` active-status join). That must be re-homed before any P9/P11/P13 push that relies on fail-closed super-admin checks. `20261112000001_d1_admin_foundation.sql` remains in the active chain.
