# 07 — Next Phase Plan (final prerequisites and gates; D-G1-10 APPROVED 2026-11-11)

## 1. Proposed G1-8B implementation scope (in order)

1. **Verification, not decisions (no code):** D-G1-10 is APPROVED — no
   further product decision needed. Read-only verify in the Supabase
   dashboard: `site_url`, redirect allowlist, email-confirmation
   requirement, recovery config, provider rate-limit/enumeration settings.
   Document exact values.
2. **Configuration corrections (dashboard only, still no migration):**
   set `site_url = https://micronestmicrotoolsesports.vercel.app`; ensure
   the allowlist holds production + `http://localhost:3000/**` callbacks;
   align confirmation/recovery redirects with real routes. Confirm Vercel
   `ssoProtection` does not gate the public production URL.
3. **Smallest server-enforced throttle:** per-IP token-bucket on
   `search_player_directory` + `get_player_by_handle` + handle-availability
   checks (exact numerics from observed traffic); generic 429s preserving
   404-equivalence; SQL clamps stay as inner guard.
4. **D-G1-10 enforcement (one narrow function revision + server check, no
   schema/RLS/projection change):** (i) app-layer: `setDiscoverability`
   asserts the confirmed-email signal from the verified session
   (`client.auth.getUser()` returns `email_confirmed_at`; already the sole
   identity authority in this path) and rejects unconfirmed callers with the
   existing generic error shape; (ii) database-level: revise narrow DEFINER
   `public.set_player_discoverability()` (additive `CREATE OR REPLACE`, least
   grants unchanged) to re-assert confirmation from the authoritative Auth
   record for `auth.uid()` and raise a generic denial otherwise — direct
   PostgREST RPC invocation then cannot bypass the gate. No RLS, grant,
   projection, or column change. Onboarding copy distinguishes signed-in
   from publishable.
5. **Auth UI + onboarding flow:** signup, confirmation/resend, login,
   recovery, and onboarding screens (bootstrap → create profile → game
   profile → explicit approved consent → publish) on the unchanged
   identity architecture. No middleware writes, no caller user IDs, no
   service-role in browser code, no base-table public reads, frozen 12
   columns preserved.

## 2. Required decisions and prerequisites

- D-G1-10: APPROVED (Option A, 2026-11-11, synchronized) — no further
  decision needed; it is the authority for step 4.
- Dashboard verification record (step 1) — prerequisite for steps 2, 4, 5.
- Throttle numerics + enforcement point — prerequisite for public launch,
  not for building UI.
- D-08/D-09 remain open with no G1-8B dependency (safe to defer).

## 3. Migration requirements

Exactly one narrow function revision: `CREATE OR REPLACE` of
`public.set_player_discoverability()` adding the confirmed-email assertion
(no table/column/policy/grant/projection change; history stays append-only).
No other schema change. Auth URL work is dashboard configuration, not DDL.
If any step beyond this claims to need a migration, stop and re-audit per
the G1-8A stop conditions.

## 4. Test gates and acceptance criteria

- `npm test` 100% (extended with §6 gaps: unconfirmed publish denial,
  login-failure genericity, recovery redirects, throttle 429 shape).
- `npm run typecheck` + `npm run lint` clean; `npm run build` green.
- Targeted integration lane (isolated `g1t8b_` identities, exact cleanup):
  signup → (unconfirmed cannot publish) → confirm → publish appears →
  withdraw hides; duplicate-email copy reveals nothing; suspended cannot
  publish; concurrent onboarding converges; recovery completes on allowlisted
  URLs only.
- Acceptance: D-G1-10 recorded; `site_url`/allowlist match production;
  throttle enforced server-side and not bypassable via direct anon RPC
  beyond clamps; no new enumerable oracle; frozen 12 columns + RLS/grants
  unchanged (re-run §2 probes as regression).
