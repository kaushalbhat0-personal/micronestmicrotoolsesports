# RLS & Security Audit (live-verified)

## Policy inventory (47 tables with policies; 4 intentional no-policy)

Per-table commands/roles verified via `pg_policies`. Shape: tenant tables `authenticated` CRUD via `is_org_member/admin`; user tables owner-scoped; finder tables owner/captain-gated with one `anon` open-posts SELECT; catalogue tables (`tools`, `plans`, meta, BGMI) publish/active-gated `anon`+`authenticated` SELECT; `orders/payments/subscriptions/entitlements/credentials` member-SELECT, service-role writes; `admin_audit_logs`/`cron_run_ledger` super-admin SELECT; `webhook_events` member-SELECT (matches repo — earlier "no client policy" prose corrected). Full definitions spot-verified for profiles/orgs/members/finder-posts/tools/plans/audit/ledger.

No-policy tables (all intentional default-deny, advisor INFO): `platform_admins`, `bgmi_ingestion_runs`, `draft_ban_monthly_completions`, `payout_tracker_monthly_publishes`.

## Advisor findings triage

- **ERROR — security-definer views (2):** `finder_public_players/teams`. Intentional masked-projection pattern; keep the pattern for new public views, ensure new views stay minimal-column by construction.
- **WARN — anon-executable definer functions (29):** mostly intentional public share RPCs (`get_completed_*`, `get_published_*`) + storage path helpers. **[Recommendation]** New-domain share RPCs need per-function anon-necessity review; default new RPCs to `authenticated`-only EXECUTE.
- **WARN — mutable search_path (8):** harden with `SET search_path` on next touch; include in new-function template from day one.
- **INFO — 19 unindexed FKs:** minor; add covering indexes with new tables (convention, not emergency).

## Gaps for the new domain (nothing to fix yet — new tables don't exist)

Missing and required later: recruiter-role policies + `is_org_recruiter()` (D-02), brand representative policies, opportunity publisher/applicant split, verification-before-publish enforcement point, expanded report targets, masked public views per new entity, ownership-transfer + soft-delete guards, block/visibility-toggle enforcement. Dangerous patterns to avoid: merging the three badges into one flag, applicant-list readability, evidence/contact columns on public views, client-writable verified-status fields (legacy got this right — copy it).

## Row-level posture

RLS enabled on 51/51 tables, none forced (service_role bypass by design for admin/RPC paths). No over-broad (`anon` INSERT/UPDATE/DELETE) grants observed. No testing-by-mutation performed.
