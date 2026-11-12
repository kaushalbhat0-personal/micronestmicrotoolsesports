# 11 — Reuse / Rebuild / Retire Matrix

**Rule:** legacy is reference-only. No migration restores, no auth/RLS/pricing copies without fresh review. Prices below are archived references, not current.

## 1. Consolidated matrix

| Subsystem / capability | Classification | Rationale | Next use |
|---|---|---|---|
| Identity anchor (`app_users`, `ensure_app_user`, `is_org_member/admin/owner`, `has_tool_access`, `is_super_admin` pattern) | REUSE | Proven narrow `SECURITY DEFINER`-style pattern; G1 already mirrors it | Keep; extend with team/org/brand member FKs |
| Admin/audit/ops (`platform_admins`, append-only `admin_audit_logs`/`organization_audit_logs`, `cron_run_ledger`, storage bucket policy pattern) | REUSE | Backbone for verification queues, publishing, retention | Dormant until needed |
| Storage buckets (`public-avatars`, `public-entity-media`, `private-verification`) | REUSE | Live + correctly scoped | Keep; wire verification bucket only when pipeline built |
| Player profiles + directory + consent + avatar + handle lifecycle | REUSE | Working, tested, live-verified | Keep frozen (G1) |
| Game catalog static-lookup + alias map | ADAPT | Pure pattern valuable; slugs need BGMI-first redesign (MLBB wave-2 gating) | Redesign slugs, keep pattern |
| Finder masked views + anti-duplicate + captain guards | ADAPT | Closest ancestor; hardcoded BGMI/flat squad/free-text regions unfit | Mine patterns; never migrate `finder_*` tables |
| Roster-Builder pure services (normalize/parse/conflict/slots/output) | ADAPT | Stateless, well-tested pure logic | Mine for organizer flows; rebuild UI/entitlement |
| Tournaments ingest adapter + body-gated observability | ADAPT | Daily workflow + validate-then-publish contract valuable | Mine for editorial tournament section; rebuild schema |
| BGMI Lab loader/island map + share-URL/challenge-banner + FAQ/related pattern | ADAPT | Supporting-engagement pattern, ephemeral by design | Mine for Phase 7; rebuild content/IA |
| Meta-Parser safe-fetch/sanitize/entity-normalize/health pipeline | ADAPT | Patch-intel ingestion pattern | Mine for news/patch section; rebuild domain |
| Billing rails (`dodo.ts`, `verify-service.ts`, webhook idempotency, live-test markers, Dodo validator script) | ADAPT | Thoroughly tested provider-agnostic rails | Mine code pattern; decide deps (D-17) before any use; never seed legacy plans |
| Sponsor-Sentinel (scan orchestrator, evidence model, multi-platform creds) | REBUILD | Brand-partnership value but org/user-grant + quota complexity needs fresh design | Fresh design if Brands pillar needs proof |
| Video/VOD live-scan automation (Vercel cron + Twitch/Kick/YouTube webhooks) | REBUILD | Only if partnerships pillar needs proof-scanning; greenfield `vercel.json` has no crons by design | Fresh design; confirm `YOUTUBE_WEBSUB_VERIFY_TOKEN` unused before removal |
| Draft-Ban / Tie-Breaker / Payout-Tracker / Prize-Splitter engines | RETIRE (dormant) | No greenfield pillar needs them | Leave migrations dormant; stop seeding; never drop without retention decision |
| VOD-Clipper / Scrim-Matchmaker / Roster-Sentinel | RETIRE | Explicitly removed in legacy (`marketing-availability.test.ts:9`) | Do not resurrect |
| BGMI Qualification Simulator | RETIRE (reference) | Points-race calculator, local-only | Reference logic only |
| Workspace analytics / standings analytics | UNKNOWN | Needs product validation of discovery/marketplace metrics | Decide after MVP metrics defined |
| `BILLING_LIVE_TEST_*` ops flags | UNKNOWN | Confirm vs live project before removal | Verify, then remove or retain |

## 2. Overlapping consolidation

- Prize-Splitter + Payout-Tracker + Tie-Breaker + Draft-Ban overlap as "organizer utilities" — all retired together; if a future organizer-tools pillar emerges, design one entitlement model, not four.
- Sponsor-Sentinel subsumes VOD/live-scan — rebuild as one proof system if needed, not two.
- Finder + Roster-Builder overlap on team formation — keep Finder patterns for discovery, Roster pure services for organizer intake; single team model when built.
- BGMI Lab drills overlap as engagement — consolidate to 1–2 profile-linked drills in Phase 7, not 9 ports.
- Tools that do not belong in esports platform: none of the retired engines belong in discovery-first MVP; Meta-Parser belongs only if news/patch section is approved.
