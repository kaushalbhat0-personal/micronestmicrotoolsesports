# 02 — Supabase Auth Configuration (P14-D12)

Project ref: `knniommcyyhbyiwljisk`. **No production Auth settings were changed.**

## Environment matrix

| Environment | How inspected | Email confirmation | Notes |
|---|---|---|---|
| **Local** (`supabase/config.toml`) | File read | `enable_confirmations = false` | Dev-only; does not dictate remote. |
| **Remote (live API behavioral)** | Disposable `signUp` probe 2026-11-27 | Effectively **OFF** — `session=true` and `email_confirmed_at=true` immediately | Host `knniommcyyhbyiwljisk.supabase.co`. Probe user deleted. |
| **Preview / Production Auth dashboard** | Management API token invalid this session | **Dashboard values UNVERIFIED** | Do not assume `config.toml` equals production. |

## Historical dashboard snapshot (P14-D11, 2026-11-16)

When Management API previously succeeded:

| Setting | Value |
|---|---|
| `site_url` | `https://micronestmicrotoolsesports.vercel.app` |
| `uri_allow_list` | `https://localhost:3000` (preview origin missing) |
| `mailer_autoconfirm` | `true` |
| `disable_signup` | `false` |

Aligned with today's behavioral probe, but **not re-read** from the dashboard this session.

## Dashboard work still required (human / authorized)

Before treating production Auth as fully certified:

1. Re-open Supabase Auth settings for `knniommcyyhbyiwljisk`.
2. Confirm **Confirm email = OFF** / autoconfirm ON (matches product policy).
3. Confirm Site URL = production app URL.
4. Expand redirect allowlist for production + preview callbacks + localhost.
5. Confirm SMTP / recovery capacity if forgot-password email delivery is required in production.

**Do not change production Auth without explicit authorization.**

## App implications

- Signup UI assumes immediate session; missing session shows a generic failure (no pending-confirm UI).
- Forgot-password remains available; delivery depends on SMTP + allowlist (unchanged from P14-D10/D11).
