# 09 — Cross-Cutting Architecture

**Frozen:** G1 identity/player-profile (`11-decision-freeze.md`). Do not modify.

## 1. Identity model
- Single identity per authenticated user: `app_users.id = auth.users.id` (`20261110000003`), lazy `ensure_app_user()` bootstrap, `status active|suspended`. Session-derived only (`client.auth.getUser()`), no user-ID args, middleware never bootstraps. Future `team_members`, `organization_members`, `brand_representatives` FK to `app_users(id)` — none exist yet.

## 2. Multi-role support
- Absent. Only `primary_role` facet (BGMI allowlist in `schemas/game.ts`) + `app_users.status`. No captain/owner/admin/recruiter/editor roles in greenfield. Legacy `is_org_member/admin/owner`, `is_super_admin()` patterns archived for future adaptation.

## 3. Multi-tenant implications
- None currently (single-user profiles). Future org/team scoping must adopt archived org-membership RLS pattern with fresh review — do not copy old RLS without security analysis.

## 4. RLS
- Greenfield: owner RLS on `player_profiles`/`player_game_profiles`, public reads on `games`, RPC-only public projection (`GRANT EXECUTE anon+authenticated` on 2 directory RPCs + `create_player_profile` to authenticated only), bucket-scoped `storage.objects` policies. Tightened grants (`20261110000004`).
- Legacy RLS: reference-only; reuse requires fresh analysis per archive rules.

## 5. Public discovery
- Working for players: private-by-default, master + per-game switches, frozen 12-col projection, consent predicate inside RPCs, 404-equivalence, `noindex` (players excluded from `sitemap.ts`).

## 6. Storage
- 3 live buckets: `public-avatars` (public, owner-scoped writes), `public-entity-media` (public, future artwork), `private-verification` (private, unwired). 512KB image limits, `avatar.jpg` canonicalization.

## 7. Moderation
- Absent. Spec reserves polymorphic `reports.target_id` (future articles/tournaments) + `platform_admins` review queue. Legacy `finder_reports` archived — adapt pattern only.

## 8. Verification
- Forbidden in G1; no badges/scores/ranks/KD. Storage bucket reserved. Legacy finder verification submissions archived — rebuild if needed.

## 9. Entitlements
- Absent. No `tools/plans/entitlements` tables, no `requireEntitlement`/`has_tool_access` in `src/`. Legacy `tool_entitlements`/`user_tool_entitlements` + `is_all_access` archived.

## 10. Billing boundaries
- Absent. Provider-behind-interface reserved (`architecture-proposal.md:18,36`); deps undecided (D-17). Legacy Razorpay+Dodo rails archived — adapt code pattern, never seed prices.

## 11. Content management
- Absent. No CMS, no editor roles, no article/tournament CRUD. Spec: editor writes, world reads published; drafts to editors.

## 12. Shared search
- Players-only (`search_player_directory` with `p_game/p_region/p_role/p_query/p_limit/p_offset`). No cross-entity search.

## 13. Notifications
- Absent (no tables, no triggers, no edge functions in primary project).

## 14. Audit history
- Absent in greenfield. Legacy append-only `admin_audit_logs` + `organization_audit_logs` + `cron_run_ledger` archived — REUSE pattern when needed.

## 15. Rate limiting
- Absent. D-G1-05 explicitly defers handle throttle; no invented limits.

No microservices needed — modular monolith (`src/features/` + `src/server/`) suffices. Do not propose services without demonstrated need.
