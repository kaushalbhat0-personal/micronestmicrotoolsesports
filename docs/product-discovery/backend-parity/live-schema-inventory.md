# Live Schema Inventory (MCP-confirmed metadata)

Row counts below are tool-reported scale metadata; no record content was read. Finder tables are empty (0 rows) — the legacy finder was never adopted in production.

## Tables (51, public schema, RLS enabled on all, none forced)

**Foundation:** `profiles` (3; id→auth.users CASCADE, email, display_name, avatar_url, primary_organization_id→orgs SET NULL), `organizations` (4; name, slug, owner_id→profiles RESTRICT, logo_url, timezone DEFAULT Asia/Kolkata), `organization_members` (4; org→CASCADE, user→profiles CASCADE, role DEFAULT member, UNIQUE(org,user)), `organization_audit_logs` (0), `tools` (9), `tool_entitlements` (14), `user_tool_entitlements` (2), `subscriptions` (0), `plans` (14), `orders` (8; provider DEFAULT razorpay, dodo_session_id, buyer_user_id→profiles SET NULL, is_live_test), `payments` (1; dodo columns present), `webhook_events` (0; platform includes dodo, status lifecycle columns), `organization_provider_credentials` (3; encrypted token columns + masked copies + expiry/scope/account columns), `platform_admins` (1), `admin_audit_logs` (0), `cron_run_ledger` (60).

**Sentinel:** `connected_channels` (3), `sponsor_campaigns` (4), `deliverables` (7), `evidence` (800), `evaluations` (759), `scans` (124).

**Draft-ban:** `draft_matches` (1; ref_code, share_token, sequence/pool/actions jsonb), `draft_templates` (5; is_starter), `draft_ban_monthly_completions` (1).

**Tie-breaker:** `competitions` (2; scoring, rule_order ARRAY, preset_ref, share_token, record_number, locked_snapshot), `teams` (8), `results` (14).

**Payout-tracker:** `trackers` (0), `recipients` (0), `monthly_publishes` (0).

**Finder (all 0 rows):** `finder_profiles` (handle PK user_id, 6-level CHECKs, is_searchable generated), `finder_game_profiles` (game CHECK bgmi, character_id format, UNIQUE(user,game) + UNIQUE(game,character_id)), `finder_verification_submissions`, `finder_teams` (game CHECK bgmi, contact_mode, external_link https CHECK), `finder_team_members`, `finder_recruitment_posts` (slots, tryout, expires_at), `finder_applications`, `finder_reports`.

**Meta-parser:** `games` (3), `patches` (15), `changes` (6181), `aliases` (230).

**BGMI hub:** `tournaments` (3), `stages` (5), `teams` (41), `stage_entries` (88), `matches` (96), `match_results` (1539), `ingestion_runs` (10).

## Views (2)

`finder_public_players` (masked game ID, no user_id/evidence/contact), `finder_public_teams` (no external_link/captain). Both SECURITY DEFINER (advisor-flagged; intentional masked-projection pattern).

## Functions (59, all plpgsql/sql)

RLS helpers `is_org_member/admin/owner`, `has_tool_access`, `is_super_admin`, finder captain/member helpers, storage path helpers (`can_manage_org_logo/finder_avatar/finder_evidence`); member RPCs (`add/remove/change/leave/transfer_organization_ownership`, `revoke_platform_admin_atomic`); billing RPCs (`complete_billing_payment`, `complete_dodo_payment`, `repair_billing_completion`); quota RPCs (`consume_free_check`, `consume_tie_breaker_lock`, `consume_draft_ban_completion`, `consume_payout_tracker_publish` + payout recipient/status/token RPCs); share RPCs (`get_completed_draft_share`, `get_completed_tie_breaker_share`, `get_published_payout_tracker`); guard triggers functions per tool; `handle_new_user`, `handle_new_organization`, `handle_updated_at`, `is_valid_iana_timezone`, ref allocators. All match repo migration names. No `oauth_tokens` function/table — that migration only ALTERed the credentials table (confirmed live columns present).

## Triggers (44)

Updated-at coverage, org owner guards (`protect_organization_owner_id`, `serialize_organization_members`, deferred `enforce_organization_owner_count`), audit append-only + ledger lifecycle guards, per-tool state guards, finder handle normalizer. Matches repo.

## Constraints / indexes

Every table has PK; FK discipline verified (tenant CASCADE, created_by→auth.users RESTRICT, owner→profiles RESTRICT, audit SET NULL); CHECK counts per table match repo design (spot-verified definitions: USD currency, dodo provider guard, IANA timezone, BGMI game literals, handle/slug regexes, entitlement all-access coherence). ~120 non-PK indexes including discovery partials and idempotency uniques. 19 unindexed-FK INFO advisories (performance, non-blocking).

## Absent (confirming no drift by omission)

No `oauth_tokens` table (never existed — migration was ALTER-only). No new-domain tables yet (no teams/org-divisions/brands/opportunities/news/tournaments-mvp/notification tables). No edge functions. Extensions installed: `uuid-ossp`, `supabase_vault` (plus defaults).
