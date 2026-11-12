# 05 — Onboarding Readiness (updated G1-8A.1: D-G1-10 Option A APPROVED 2026-11-11)

Legend: BLOCKING = must resolve before any public signup. NON-BLOCKING =
may ship in G1-8B order but does not gate the first decision.

## 1. Signup

- No public signup UI exists (verified: no signup/login/recovery routes or
  forms in `src/app`; only `players`, `settings/profile`, `api/health`).
  **BLOCKING (build scope, G1-8B).**
- Provider signup behavior (open signup, confirmation requirement,
  autoconfirm): UNVERIFIED remotely. **BLOCKING (verify in dashboard).**
- Identity bootstrap after signup is ready: lazy `ensure_app_user()`,
  idempotent, concurrency-safe, session-derived, no middleware writes.
  NON-BLOCKING (done, G1-1 PASS re-verified).

## 2. Confirmation

- D-G1-10 APPROVED (Option A, 2026-11-11): verified email is a prerequisite
  for enabling `is_discoverable`; unverified registration, sessions, and
  private profiles are unaffected. Enforcement implementation is G1-8B scope
  (see `07-next-phase-plan.md`).
- Confirmation/resend UX does not exist. **BLOCKING (G1-8B build).**
- `site_url` + redirect allowlist UNVERIFIED; confirmation links depend on
  both. **BLOCKING (verify + correct per `01-auth-configuration.md` §5).**

## 3. Login

- No login UI exists. Session model (`@supabase/ssr` cookies + `getUser()`
  as sole authority) is implemented and used by every server operation.
  **BLOCKING (build scope, G1-8B); architecture NON-BLOCKING (ready).**
- Login failure responses: no login form exists to evaluate; provider
  enumeration behavior UNVERIFIED. Copy must use generic errors
  (established pattern: `UnauthenticatedError`, no existence oracle).
  **BLOCKING (verify provider setting + follow generic-error pattern).**

## 4. Recovery

- No recovery UI or `resetPasswordForEmail` flow exists; recovery redirect
  config UNVERIFIED. **BLOCKING (verify config + build in G1-8B).**
- Recovery composes with Option A (D-G1-10): mailbox control re-confirms.
  No architecture change needed. NON-BLOCKING once config is verified.

## 5. Onboarding (profile creation → publish)

- Private onboarding substrate ready: canonical profile (G1-2), game
  profiles (G1-3), avatars (G1-5), consent + visibility + handle + deletion
  (G1-7), directory/routes read-only (G1-4/G1-6) — all re-verified intact.
  NON-BLOCKING.
- Missing: end-to-end onboarding screens wiring signup → bootstrap →
  create profile → add game profile → explicit consent (approved copy) →
  publish. **BLOCKING (G1-8B build).**
- Duplicate-signup behavior: safe by construction (one Auth user → one
  `app_users` row → one profile via PK/UNIQUE; losers get deterministic
  domain errors). NON-BLOCKING, covered by existing integration lanes.

## 6. Blocking vs non-blocking summary (G1-8A.1)

RESOLVED: D-G1-10 decision (Option A APPROVED 2026-11-11, synchronized).

BLOCKING: `site_url`/allowlist verification + correction; Auth provider
settings verification (signup, confirmation, recovery, enumeration
protection); confirmed-email publish-gate implementation (server action +
narrow DEFINER enforcement, G1-8B); search/handle-availability throttling
implementation; signup/login/recovery/confirmation/onboarding UI build with
G1-8B test gates.

NON-BLOCKING: identity bootstrap, RLS/grants, RPC projection, consent and
lifecycle operations, error-message hygiene — all verified intact and
reusable unchanged.
