# 02 — Supabase Auth Configuration (P14-D11)

Project: `knniommcyyhbyiwljisk`. No Auth settings were modified.

## Dashboard / Management API status (this run)

`GET /v1/projects/knniommcyyhbyiwljisk/config/auth` via the local
`SUPABASE_ACCESS_TOKEN` returned **HTTP Invalid access token**. Supabase CLI
`projects list` likewise failed with the same token.

**Verdict for this run:** hosted Auth dashboard values are **unverified via API**
on 2026-11-27. Findings below are from **behavioral probes against the live
project** plus the prior read-only Management API inspection recorded on
2026-11-16 (same project). Where only prior API evidence exists, it is labelled
as historical — not re-confirmed from the dashboard today.

## Behavioral findings (live, this run)

| Observation | Evidence | Implication |
|---|---|---|
| Signup returns a session immediately | `signUp` → `session=true` | Email confirmation is effectively **OFF** (`mailer_autoconfirm` behavior). Confirmation-ON path **not exercised**. |
| Signup open | Valid disposable signup succeeds | `disable_signup` effectively false. |
| Password min length 8 | `Password should be at least 8 characters.` | Matches app `PASSWORD_MIN_LENGTH = 8`. |
| Unverified users cannot sign in | Admin-created user with `email_confirm=false` → `Email not confirmed` | Unverified gate is live. |
| Banned users cannot sign in | `ban_duration` set → `User is banned` | Suspended/banned restriction holds. |
| Preview redirect not allowlisted | `admin.generateLink(type=recovery, redirectTo=preview callback)` → `redirect_host=micronestmicrotoolsesports.vercel.app`, `uses_preview=false` | Preview origin is **not** in the effective redirect allowlist; GoTrue overrides to production site URL. |
| Email/password only | Forms + live API use email/password; no OAuth UI | Matches email-only implementation. |

## Historical Management API snapshot (2026-11-16, not re-fetched)

Previous successful read-only inspect reported:

| Setting | Reported value |
|---|---|
| `site_url` | `https://micronestmicrotoolsesports.vercel.app` |
| `uri_allow_list` | `https://localhost:3000` only |
| `mailer_autoconfirm` | `true` |
| `disable_signup` | `false` |
| `mailer_allow_unverified_email_sign_ins` | `false` |
| `rate_limit_email_sent` | `2` |
| OAuth externals | disabled |

These align with today's behavioral probes, but are **not** claimed as a fresh
dashboard read.

## Callback compatibility

- App route `/auth/callback?code=` exchanges via `exchangeCodeForSession`, then
  redirects through `safeNextPath` (invalid/expired → `/login?error=link-expired`).
- Compatible with PKCE `?code=` **if** links can be minted for the preview origin.
- They cannot today (redirect override above). Real email-link redemption on
  preview remains **blocked** pending an allowlist change (out of bounds).

## Unverified items (explicit)

- Fresh Site URL / URI allow-list / SMTP / rate-limit values from dashboard/API
  this session: **unverified** (token invalid).
- Confirmation-ON mode: **not tested** (live behavior is confirmation-OFF).
