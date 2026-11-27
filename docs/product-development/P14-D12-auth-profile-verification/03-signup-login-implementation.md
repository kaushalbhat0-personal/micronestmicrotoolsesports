# 03 — Signup / Login Implementation (P14-D12)

## Signup (`src/app/signup/`)

- Fields: display name, email, password, confirm password, show/hide toggles.
- Validation: shared `src/lib/auth/validation.ts` + friendly alerts.
- `signUp` stores `display_name` in auth metadata; redirects via
  `safeSignupNextPath` → default **`/onboarding/profile`**.
- **No confirmation-pending / resend UI** (removed).
- If Auth returns no session: generic failure asking the user to try login /
  support — never a verify-email workflow.
- Header Sign up / Log in actions retained (`site-header-shell`).

## Login (`src/app/login/`)

- Email / password; redirects through `safeNextPath` (intended protected
  destination, else `/workspace/teams`).
- Errors are generic (no confirm-email branch).
- Forgot-password link retained (compatible with recovery; delivery depends
  on SMTP/allowlist — see 02).

## Callback / logout

- `/auth/callback` unchanged: code exchange + allowlisted `next`
  (now includes `/onboarding/profile`).
- `/logout` clears cookie session.

## Redirect allowlist (`src/lib/auth/redirect.ts`)

Added:

- Exact: `/onboarding/profile`
- Prefix: `/onboarding/`
- Helpers: `SIGNUP_DEFAULT_NEXT_PATH`, `safeSignupNextPath`
