# 04 — Login and Callback Implementation (P14-D10)

## Login (`/login`)

- Reused existing cookie-session infrastructure; redesigned to Arena treatment with
  crimson primary, visibility toggle, and links to `/signup` + `/forgot-password`.
- Validation: shared `validateEmail`/`validatePassword` before `signInWithPassword`.
- Errors: generic "Could not sign in…" except confirmation keywords
  (confirm/verify) → "Please verify your email…". `?error=link-expired` from callback
  surfaces "link expired or already used".
- Redirect: shared `safeNextPath(?next=)` → `router.replace(next)` + `router.refresh()`.
  Cookie session verified by existing middleware refresh + server `getUser()`.

## Callback (`/auth/callback`, GET)

- `?code=` → server `exchangeCodeForSession` (httpOnly cookies set server-side),
  then redirect to validated `next`. Invalid/expired code → `/login?error=link-expired&next=`.
- No code → redirect to validated `next` (safe default `/workspace/teams`).
- Serves email-confirmation, recovery, and any future OAuth links without new code.

## Redirect safety (`src/lib/auth/redirect.ts`)

- `DEFAULT_NEXT_PATH = /workspace/teams`; exact allowlist
  (`/workspace/teams`, `/teams/new`, `/settings/profile`) + `/workspace/` prefix.
- Rejects absolute URLs, `//`, backslashes, colons, whitespace/`<>`; bare `/workspace`
  falls back. Shared by login, signup, callback. Covered by `redirect.test.ts`
  (exact, prefix, external/protocol-relative, non-allowlisted public paths).

## Recovery (`/forgot-password`)

- `resetPasswordForEmail(email, { redirectTo: origin/auth/callback?next=/settings/profile })`;
  generic sent/not-sent copy (no enumeration). Works if SMTP/recovery is configured;
  otherwise surfaces a retry message. No recovery link existed before.

## Preserved behavior

- Verified-email requirement untouched (RPC layer still gates team creation).
- Suspended accounts still fail closed (`SuspendedError` → support copy, no write access).
- Logout (`POST /logout`) unchanged; header account menu + mobile panel post to it.
