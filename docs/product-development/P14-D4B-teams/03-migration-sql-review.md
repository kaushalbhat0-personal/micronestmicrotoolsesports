# 03 — Migration SQL Review (P14-D4B)

## Pending set reviewed (pre-apply)

| File | SHA-256 |
| --- | --- |
| `20261112000001_d1_admin_foundation.sql` | `90E6F463…64B192` |
| `20261112000002_p14_admin_superadmin_active_gate.sql` | `E9066ABA…97A6CC` |
| `20261112000005_p9_organizer_foundation.sql` | `B8B747C6…BE9EF2` |
| `20261112000006_p9_tournament_link.sql` | `12CC0C8D…948054` |
| `20261113000001_p11_f01_trust_guard.sql` | `3AE4054C…207B95` |
| `20261113000002_p11_f02_published_integrity.sql` | `A3917806…B01B43` |
| `20261113000003_p11_moderation_queue.sql` | `1CA6E2FD…F7A878` |
| `20261113000004_p13_f02_snapshot.sql` | `AA3DAD7C…B0DC73` |
| `20261113000005_p13_activation.sql` | `E2289CE0…FFF0AE` |
| `20261114000001_p14_teams_foundation.sql` | `3DD6AF26…415B22` |
| `20261114000002_p14_team_members.sql` | `CF8E6F1E…7F8722` |
| `20261114000003_p14_team_audit_events.sql` | `2C67057E…939C49` |
| `20261114000004_p14_team_public_rpcs.sql` | `9617E4F4…0826A6` |
| `20261114000005_p14_team_mutation_rpcs.sql` | `EC34BA90…C15A5C` |

(Full hashes captured in execution shell; truncated in table for readability — complete digests in Stage apply log.)

## Dependency / safety checks

| Check | Result |
| --- | --- |
| F-A01 `is_super_admin` before P9/P11/P13 | Yes (`20261112000002`) |
| Archived D1 Teams in active dir | No |
| Destructive `DROP TABLE` / `TRUNCATE` / reset in pending set | None found |
| Teams depends on G1 `app_users`/`games`/`handle_updated_at` | Present remotely |
| Duplicate Teams object risk | None (tables absent pre-apply) |

## Contract alignment (Teams)

- Owner via `owner_user_id`; one `game_key`; unique slug
- Roles/statuses per A1–A4; `is_team_captain` = owner OR active `captain` (co-captain excluded)
- Audit append-only; public RPCs aggregate `member_count` only
- Mutations: session `auth.uid()`, verified email on create, allowlisted settings update
