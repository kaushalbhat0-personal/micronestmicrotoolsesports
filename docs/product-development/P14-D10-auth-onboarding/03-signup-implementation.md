# 03 — Signup Implementation (P14-D10)

## Routes

- `/signup` (`src/app/signup/page.tsx`, `dynamic=force-dynamic`, `robots noindex`).
  Links from header (desktop + mobile), footer, homepage hero (`Sign up free`),
  closing CTA, and workspace sign-in prompt (`?next=/workspace/teams`).

## Flow (email/password only — no OAuth configured)

- Fields: display name (2–60), email, password + confirm, visibility toggles
  (`aria-pressed`, `aria-label`), client validation via
  `src/lib/auth/validation.ts` before any network call.
- `supabase.auth.signUp({ email, password, options: { data: { display_name },
emailRedirectTo: origin + /auth/callback?next= } })`. No second auth system, no schema
  change (name lives in auth metadata; profile creation stays in existing onboarding).
- Confirmation-enabled (no session returned): pending screen "Check your inbox … not
  active until you confirm" + `resend({ type: "signup" })` action. Never claims completion.
- Confirmation-disabled (session returned): `router.replace(next)` + `router.refresh()`.
- Errors: generic mapping (existing-email → "already registered, try logging in";
  password → requirements; else retry). No enumeration oracle.

## Files

- `src/app/signup/page.tsx`, `src/app/signup/signup-form.tsx`,
  `src/app/signup/signup-form.test.tsx` (labels, requirements, toggles, recovery link).
- `src/lib/auth/validation.ts` + test (email/password/display-name bounds).
