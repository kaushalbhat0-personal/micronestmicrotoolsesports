# G1-8A / G1-8A.1 — Onboarding Readiness & Supabase Auth Decision Closure

Scope: read-only readiness audit plus the D-G1-10 approval synchronization
(G1-8A.1). No signup, login, recovery, or onboarding UI was built in this
phase. No migrations applied, no production configuration changed, no
commits, no pushes, no deployments.

Authoritative inputs: `docs/architecture/g1-identity-player-profile/10-open-decisions.md`,
`11-decision-freeze.md`, `12-implementation-test-plan.md`,
`D-G1-04-decision-brief.md`, G1-1 through G1-7 implementation reports, live
repository source, local `supabase/config.toml` (local-dev only), and read-only
remote inspection of Supabase project `knniommcyyhbyiwljisk` plus Vercel
project `prj_qIXcAEb9pL2Cnf2HCJesyVndAJ4Y` on 2026-11-11.

## Overall verdict (G1-8A.1, 2026-11-11)

**CONDITIONAL PASS** — D-G1-10 Option A is synchronized as APPROVED in the
architecture freeze (`10-open-decisions.md`, `11-decision-freeze.md`) and the
remote database state is re-verified unchanged, but Auth-configuration
inspection and the G1-8B enforcement implementation remain unresolved.

## Important findings

1. D-G1-10 Option A (require verified email before public discoverability)
   approved by the product owner on 2026-11-11 and synchronized into
   `10-open-decisions.md` (APPROVED section + CLOSED stage-gate entry) and
   `11-decision-freeze.md` (nine approvals; provenance; frozen behavior;
   affected-documents; closed remaining-open entry; updated onboarding
   gate). Original wording preserved; no unrelated decision altered.
2. Primary Supabase project identity re-verified read-only in G1-8A.1: ref
   `knniommcyyhbyiwljisk`, name `micronestmicrotoolsesports`, region
   `ap-northeast-1`, status `ACTIVE_HEALTHY`, PG `17.6.1.171`. Migration
   history unchanged (same 9 records); no function body references
   `email_confirmed_*` (gate not yet implemented — G1-8B scope, as intended).
   Sibling `whitelabel-lms` (`iwgefthgciddukqabkun`) never accessed.
3. G1 security boundaries intact on remote: RLS enabled on all 4 public
   tables; owner-only policies with `auth.uid()` + active-status gates;
   column-level UPDATE grants deny direct `handle`/`is_discoverable` writes;
   frozen 12-column RPC output with no `game_user_id`, no `EXECUTE`, no
   `SELECT *`; least-privilege EXECUTE grants; zero data rows; `bgmi` active.
3. D-G1-10 remains the single open product-owner decision gating public
   onboarding. [SUPERSEDED by G1-8A.1: D-G1-10 Option A APPROVED 2026-11-11;
   see `04-dg1-10-decision-brief.md`.]
   No email-confirmation gate exists in code or RPCs today (verified by grep
   + function bodies): `set_player_discoverability`, `create_player_profile`,
   and `ensure_app_user` do not reference `email_confirmed_at`.
   [G1-8A.1: still true post-approval — enforcement is G1-8B scope.]
4. Remote Supabase Auth configuration (site_url, redirect allowlist,
   email-confirmation requirement, recovery, session handling, templates)
   **cannot be verified** through authorized read-only tooling (no Auth-config
   MCP tool; `auth.*` exposes no config table). All such settings are marked
   UNVERIFIED in `01-auth-configuration.md`. Local `supabase/config.toml`
   values are local-dev only, not remote evidence.
5. Production Vercel domain verified read-only:
   `micronestmicrotoolsesports.vercel.app` (verified, sole custom entry in
   project-domains list; latest production deployment READY). Whether
   Supabase `site_url`/allowlist matches it is UNVERIFIED (see 4).
6. Abuse prevention gap confirmed, not new: no application or database
   rate limiting on directory RPCs or handle availability. Only DoS clamps
   exist (LIMIT 1..48, OFFSET 0..1000, query cap 120, Zod shape checks).
   Direct anon RPC invocation is constrained only by those clamps. Supabase
   provider-level Auth rate limits are UNVERIFIED remotely.
7. No whole-account deletion, no Better Auth, no middleware writes, no
   caller-supplied user IDs, no service-role in browser code. Handle-taken
   remains the accepted enumerable residual.

## Recommended next phase

G1-8B (see `07-next-phase-plan.md`): with D-G1-10 now APPROVED, verify/harden
`site_url` + redirect allowlist in the Supabase dashboard (read-only verify
first, then apply the documented corrections); implement the database-level
confirmed-email publish gate plus the smallest server-enforced
directory/handle-availability throttle; then build signup, confirmation,
login, recovery, and onboarding UI against the unchanged identity
architecture with the G1-8B test gates green. No schema change beyond the
single narrow DEFINER-function revision is approved in this audit.
