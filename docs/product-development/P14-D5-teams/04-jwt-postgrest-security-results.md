# 04 — JWT / PostgREST Security Results (P14-D5)

Transport: real Supabase-issued JWTs via `curl` → `/rest/v1/rpc/*` and table paths.  
**31/31 PASS** after classifying anon direct table deny (HTTP 401) as expected.

| ID | Method / endpoint | Role | Expected | Actual | Result |
| --- | --- | --- | --- | --- | --- |
| anon.search_teams | POST `/rpc/search_teams` | anon | 200 | 200 | PASS |
| anon.get_missing | POST `/rpc/get_team_by_slug` | anon | empty | 200 `[]` | PASS |
| anon.create_denied | POST `/rpc/create_team` | anon | deny | **401** | PASS |
| unverified.create_denied | POST `/rpc/create_team` | JWT unverified | deny | **403** | PASS |
| suspended.create_denied | POST `/rpc/create_team` | JWT suspended | deny | **403** | PASS |
| owner.create_public | POST `/rpc/create_team` | owner | 200 | 200 | PASS |
| owner.create_private | POST `/rpc/create_team` | owner | 200 | 200 | PASS |
| owner.duplicate_slug | POST `/rpc/create_team` | owner | conflict | **409** | PASS |
| create.atomic | catalog check | — | 1 team + 1 captain + 1 audit + owner=uid | matched | PASS |
| anon.search_finds_public | POST `/rpc/search_teams` | anon | finds public, no owner id | matched | PASS |
| anon.search_hides_private | POST `/rpc/search_teams` | anon | no private slug | matched | PASS |
| anon.detail_hides_private | POST `/rpc/get_team_by_slug` | anon | empty | `[]` | PASS |
| anon.detail_public_projection | POST `/rpc/get_team_by_slug` | anon | public keys + `member_count` | no `owner_user_id` | PASS |
| owner.update_ok | POST `/rpc/update_team_settings` | owner | 200 | 200 | PASS |
| captain.update_ok | POST `/rpc/update_team_settings` | captain | 200 | 200 | PASS |
| cocap.update_denied | POST `/rpc/update_team_settings` | co-captain | deny | **403** | PASS |
| player.update_denied | POST `/rpc/update_team_settings` | player | deny | **403** | PASS |
| sub.update_denied | POST `/rpc/update_team_settings` | sub | deny | **403** | PASS |
| outsider.update_denied | POST `/rpc/update_team_settings` | non-member | deny | **403** | PASS |
| cross_team.update_denied | POST `/rpc/update_team_settings` | outsider→private | deny | **403** | PASS |
| anon.direct_teams_read | GET `/teams` | anon | deny (no SELECT grant) | **401** | PASS |
| anon.direct_teams_insert | POST `/teams` | anon | deny | **401** | PASS |
| owner.direct_teams_select | GET `/teams?id=eq…` | owner | 200 (member SELECT) | 200 | PASS |
| owner.direct_teams_patch | PATCH `/teams` | owner | deny | **403** | PASS |
| owner.direct_members_insert | POST `/team_members` | owner | deny | **403** | PASS |
| owner.direct_audit_read | GET `/team_audit_events` | owner | deny/empty | **403** | PASS |
| owner.direct_audit_insert | POST `/team_audit_events` | owner | deny | **403** | PASS |
| owner.direct_audit_delete | DELETE `/team_audit_events` | owner | deny | **403** | PASS |
| owner.cannot_transfer_direct | PATCH owner_user_id | owner | deny | **403** | PASS |
| transfer_rpc_absent | POST `/rpc/transfer_team` | owner | absent | **404** | PASS |
| audit.settings_events | catalog | — | ≥1 `team.settings_updated` | count=2 | PASS |

No tokens or passwords recorded.
