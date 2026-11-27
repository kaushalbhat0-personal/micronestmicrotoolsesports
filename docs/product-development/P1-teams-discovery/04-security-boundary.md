# P1 Security Boundary Report

## Data boundary

- **RPC-only public reads.** `/teams` and `/teams/[slug]` read exclusively
  through `searchTeams` / `getTeamBySlug` (anon-safe clients, identity-free
  inputs). The static audit `src/app/teams/routes.test.ts` fails the build
  on: any `.from("…")` table access, any `public.teams / team_members /
  recruitment_posts / applications / reports / app_users / player_profiles`
  reference, any service-role/admin/signed-URL surface, and any
  `owner_user_id / created_by / organization_id / applicant_user_id /
  decided_by / decided_at` token in route sources.
- **Strict output mapping.** Exactly the 9 public columns in contract order
  (+ `description` for detail); extra keys (owner, org, timestamps,
  applicant data, future leaks) fail the row closed. `member_count` is
  normalized to a safe integer; anything else fails closed.
- **Fail-closed filters.** Unknown games pass through to zero rows (no
  existence oracle); malformed regions for known games are rejected
  pre-RPC with an explained empty state; invalid URL params are dropped
  and named, never executed. Pagination is bounded (24/page, 42 pages max,
  offset ≤ 984 < 1000 ceiling); query capped at 120 chars at the schema
  boundary with SQL-side escaping at the RPC.
- **Generic errors.** Transport failures (including the current
  missing-function state) map to `TeamDirectoryOperationError` with no
  PostgREST detail; detail misses map to `null` → identical 404 for
  missing/private/invalid (no existence signal). Metadata builders consume
  projection fields only.

## Write boundary

- **No write path exists.** No `"use server"`, no server action, no
  `.insert/.update/.delete/.upsert` in any team route module (audit
  enforced). Both forms (`TeamForm`, `ApplicationForm`) have no `action`
  and disabled submits with explicit boundary notices. No service-role
  import anywhere in the vertical. No client-side Supabase write.
- Session-derived identity is untouched: discovery reads are
  identity-free; future writes must derive identity server-side at an
  approved operation layer (not built in P1).

## Isolation

- Cross-user isolation inherits the D1 design (RLS default-deny, RPC
  masking) but is **unverified live**: the migrations are unapplied, so no
  PostgREST/RLS execution evidence exists yet. The required verification
  sequence (direct PostgREST behavior, cross-user isolation, RLS/RPC tests
  on disposable replay) is recorded as a pre-liveness gate in
  `06-blockers-next-phase.md`. Nothing in P1 weakens or anticipates that
  gate: unauthorized functionality is unavailable, not faked.

## G1 non-regression

- Zero G1 files modified (identity, player RPCs, frozen 12-column
  projection, grants, storage policies, discoverability behavior). Full
  unit suite green: 407 passed, 0 failed, including all G1 and D1 static
  boundary tests. Typecheck, lint, and production build clean.
- Legacy: no imports from `ref/legacy-project/`; no restored migrations,
  RLS, auth, billing, or entitlements.
