# 02 — Remote Migration Reconciliation (P14-D4B)

## Before (remote ledger)

| Version | Classification |
| --- | --- |
| `20261110000001`, `20261110000002` | Applied; matches local |
| `20261110135602`, `…135654`, `…141108`, `…143759`, `20261111072251`, `…090645`, `…091947` | **Unexpected stamps** — dashboard-applied G1 content (local `000003`–`000009`) |
| Local `20261110000003`–`20261111000009` | Not in remote ledger (schema effects present) |
| Local `20261112000001` onward (admin/P9/P11/P13/P14) | **Not applied** |
| Archived D1 Teams `000002`/`000003`/`000004` | Intentionally excluded |

## Independent G1 content proof (pre-repair)

Remote catalog (elevated SQL):

- Tables: `app_users`, `games`, `player_profiles`, `player_game_profiles` — RLS on
- Functions: `ensure_app_user`, `create_player_profile`, `search_player_directory`, `get_player_by_handle`, `set_player_discoverability`, `update_player_handle`, `handle_updated_at`
- Storage buckets: `public-avatars`, `public-entity-media`, `private-verification`
- `games`: 1 row `bgmi`
- Counts: `app_users=0`, `player_profiles=0`, `auth.users=0`
- **Absent:** `teams`, `team_members`, `team_audit_events`, `platform_admins`, organizers

Matches P14-C2 / local G1 `03`–`09` intent. Stamp drift only.

## Narrow ledger repair (authorized after proof)

Commands (secrets redacted):

```text
npx supabase migration repair --linked --status reverted --yes \
  20261110135602 20261110135654 20261110141108 20261110143759 \
  20261111072251 20261111090645 20261111091947

npx supabase migration repair --linked --status applied --yes \
  20261110000003 20261110000004 20261110000005 20261110000006 \
  20261110000007 20261111000008 20261111000009
```

No schema DDL in repair. No `db pull`. No archived Teams SQL.

## Dry-run after repair

Would push exactly 14 files (admin → F-A01 → P9 → P11 → P13 → P14 Teams `00001`–`00005`). Exit 0.

## After apply (final ledger)

All 23 active-chain versions present remotely and matched locally. No archived D1 Teams versions. No orphan stamps remaining.
