# Backend Reuse Audit

**Scope:** `supabase/config.toml`, `supabase/seed.sql`, all 58 migrations, sampled generated types and legacy repos. Read-only; nothing modified. No secrets printed. Project identity: not determinable from safe metadata (config is local-dev only; no project ref stored in repo) **[Needs validation]** against the live project dashboard before any backend work.

**Standing recommendation: retain the existing Supabase project.** No technical or security reason for a new project was found. What follows keeps foundation, leaves legacy-tool tables dormant, and adds new-domain tables later via migrations (not in this phase).

## Classification

### REUSE AS-IS

- `profiles`, `organizations`, `organization_members` (+ `timezone`, `logo_url`, `primary_organization_id`) — identity/tenancy core; matches new domain's User/Org/Membership needs.
- RLS helpers `is_org_member`, `is_org_admin`, `is_org_owner`, `has_tool_access`, `is_super_admin` — proven, narrow `SECURITY DEFINER` pattern; new-domain policies should follow the same shape.
- `platform_admins`, `admin_audit_logs` (append-only triggers), `organization_audit_logs`, `cron_run_ledger` (lifecycle triggers) — admin/audit/ops backbone for verification queues, reports, publishing.
- `tools`, `tool_entitlements`, `user_tool_entitlements`, `plans`, `orders`, `payments`, `webhook_events`, billing RPCs (`complete_billing_payment`, `complete_dodo_payment`, `repair_billing_completion`) — monetization rails if ever needed; dormant until then.
- Storage buckets `org-logos` (public), `finder-avatars` (public), `finder-verification` (private) + path-segment policy pattern — directly reusable for team/org/brand logos and verification evidence.
- Auth local config (email signup, no confirmations locally, Google/GitHub disabled) — adequate for greenfield start; harden (confirmations, OAuth) only when product requires it.
- No edge functions exist (`supabase/functions/` absent) — nothing to migrate; keep logic in Postgres RPCs + app service-role clients.

### REUSE WITH ADAPTATION

- Legacy finder suite (`finder_profiles`, `finder_game_profiles`, `finder_verification_submissions`, `finder_teams`, `finder_team_members`, `finder_recruitment_posts`, `finder_applications`, `finder_reports` + `finder_public_players`/`finder_public_teams` views) — closest conceptual ancestor (masked views, partial-unique anti-duplicates, captain guards, self-reported labelling). **[Recommendation]** Do not migrate as-is: hardcoded `bgmi`, flat single-squad teams, no orgs/brands/staff, free-text regions. Mine for patterns; design new-domain tables fresh (per-title GameProfiles, org-affiliated teams, brand entities, shared opportunity engine).
- `organization_provider_credentials` (encrypted creds pattern) — keep pattern; only needed if integrations return.
- `handle_new_organization` trigger (owner-member provisioning) — keep; grandfather/auto-grant history is legacy billing context, not a blocker.
- Generated types `ref/legacy-platform/src/types/database.ts` — hand-written and incomplete (missing tie-breaker/payout/BGMI/admin/audit/Dodo/USD). Regenerate from live schema when backend work starts; never hand-extend.

### REPLACE IN NEW APPLICATION

- All data access: legacy repositories/services under `ref/legacy-platform/src/server/` and `src/features/` target legacy tables and org/entitlement flows; new app gets domain-oriented modules with server-side authorization (see architecture proposal). Nothing imports from `ref/`.

### DEPRECATE (leave dormant, do not delete)

- Sponsor-sentinel tables (`connected_channels`, `sponsor_campaigns`, `deliverables`, `evidence`, `evaluations`, `scans`), draft-ban, tie-breaker, payout-tracker, meta-parser, BGMI tournament hub tables, per-tool quota ledgers and free-tier gating RPCs. **[Recommendation]** Keep migrations history intact; stop seeding their tools/plans for new environments when that decision is approved; never drop tables without a data-retention decision.
- Legacy seed content (microtool tools/plans, BMSD-2026 data, dota-2 game row) — production seed for the new platform is a separate decision.

### UNKNOWN — NEEDS VALIDATION

- Live project parity: do the 58 local migrations match the hosted project? Are there drift, extra buckets, auth hooks, or extensions invisible in the repo? **[Needs validation]** Run read-only checks (migration history, table list, RLS status, storage list) against the live project before writing any new migration.
- `YOUTUBE_WEBSUB_VERIFY_TOKEN` and `BILLING_LIVE_TEST_*` operational status — confirm unused before removing from env docs.
- next.config `db:types` `$SUPABASE_PROJECT_ID` shell-only syntax — confirm intended CLI environment.

## RLS posture found

Tenant tables gate on `is_org_member(organization_id)`; user-scoped finder tables on `owner = auth.uid()` with captain helpers; evidence/evaluations append-only; creds/entitlements/orders/payments member-read/service-role-write; `tools`/`plans`/meta/BGMI publish-gated public reads; `platform_admins`/`webhook_events`/ledgers default-deny with narrow grants. The new domain should copy this layered shape (public projection vs private base, owner vs admin vs representative vs applicant, super-admin queue reads) — details in `rls-and-authorization-model.md`. No policies written in this phase.
