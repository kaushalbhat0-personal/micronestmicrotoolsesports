# 05 — Discovery Database Design (GATE D1.5)

## ERD (D1)

`app_users(1)──<(player_profiles)` · `app_users(1)──<(player_game_profiles)` · `games(1)──<(player_game_profiles|teams|recruitment_posts)` · `app_users(1)──<(teams owner/created)` · `teams(1)──<(team_members|recruitment_posts)` · `team_members(*)>──<(app_users)` · `recruitment_posts(1)──<(applications)` · `app_users(1)──<(applications applicant|decided_by|reports reporter)`

No org/brand tables in D1. `teams.organization_id TEXT NULL` reserves future FK (no constraint).

## Contracts

- **teams:** `id uuid PK`, `slug` unique `^[a-z0-9]+(-[a-z0-9]+)*$` 2–60, `name` 2–60, `game_key→games RESTRICT`, `region_code` BGMI vocab, `description≤1000`, levels ∈ 6-step, `recruiting/is_public` bool, `owner_user_id→app_users RESTRICT`, `organization_id TEXT NULL`, `created_by→app_users RESTRICT`, `handle_updated_at()` trigger.
- **team_members:** `PK(team_id,user_id)`, `team_id→teams CASCADE`, `user_id→app_users CASCADE`, `role∈{captain,co-captain,player,sub}`, `game_role∈BGMI|null`.
- **recruitment_posts:** `id PK`, `team_id→teams CASCADE`, `game_key→games RESTRICT`, `role_needed` BGMI, `slots 1–10`, levels, `region_code` BGMI vocab, `availability_required text[]`, `tryout_required`, `status∈{open,paused,closed,filled}` default open, `expires_at` default +30d, `created_by→app_users RESTRICT`.
- **applications:** `id PK`, `post_id→posts CASCADE`, `applicant→app_users CASCADE`, `note≤200`, `status∈{applied,shortlisted,accepted,declined,withdrawn}` default applied, `decided_by→app_users SET NULL` + `decided_at` (both null or both set), partial unique `(post_id,applicant)` where active.
- **reports:** `id PK`, `reporter→app_users CASCADE`, `target_type∈{player,team,recruitment_post,application}`, `target_id uuid`, `reason 10–1000`, `status∈{open,reviewing,resolved,dismissed}` default open.

## RLS / RPC / grants

- Helpers `is_team_member(uuid)`, `is_team_captain(uuid)` (`SECURITY DEFINER`, `search_path=''`, `authenticated` execute only).
- `search_teams(p_game,p_region,p_query,p_limit≤60,p_offset)` + `get_team_by_slug(p_slug)` (`SECURITY DEFINER`, masked columns only: no owner/created/org; `member_count` derived). `GRANT EXECUTE anon,authenticated`.
- RLS: owner/creator + `is_team_member/captain` gates; applicant owns rows; captains read/decide their posts; reports insert-only (`status='open'`), no select/update/delete policies (admin boundary). Active-account guard (`app_users.status='active'`) on inserts/updates. Anon: RPCs only, no base-table SELECT.
- Grants: revoke-all from anon/public; least-privilege to authenticated per table (reports: insert-only); helpers/RPCs as above.

## Integration / behavior

- FKs: `player_profiles(user_id)→app_users CASCADE` preserved; new `team_members.user_id`/`applications.applicant`/`reports.reporter` → `app_users CASCADE`; `game_key` → `games RESTRICT`; no orphan game profiles/teams.
- Unique: `teams.slug`, `applications_active_unique`.
- Deletion: team delete cascades members/posts/applications; member leave deletes row; owner account delete restricted (transfer first); application rows never auto-deleted except via post/team cascade; reports preserved (`reporter SET NULL`? D1 uses CASCADE — reviewer copies evidence before account purge; documented in `09`).
- Rollback: drop D1 tables/functions in reverse dependency order; G1 objects untouched (no shared DDL).

## Files / status

- `supabase/migrations/20261112000001_d1_admin_foundation.sql` (pending).
- `supabase/migrations/20261112000002_d1_teams_discovery.sql` (pending).
- Live DB verified: 4 tables / 9 migrations; D1 objects absent (no conflict). NOT applied — pending acceptance (see `06`, `09`).
