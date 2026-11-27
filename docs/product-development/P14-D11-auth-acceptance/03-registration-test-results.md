# 03 — Registration Test Results (P14-D11)

Live project `knniommcyyhbyiwljisk`, preview
`micronestmicrotoolsesports-56tuaj8c4-kaushal-bhats-projects.vercel.app`.
Disposable addresses `p14d11-*@micronest-esports.invalid` (and a few
`@example.com` probes). No passwords or tokens recorded.

## API matrix (supabase-js against live project)

| Case | Result |
|---|---|
| Valid signup | PASS — no error, **session returned immediately** (`session=true`). Confirms confirmation-disabled live path. |
| Duplicate email | PASS — `User already registered`. |
| Invalid email (`not-an-email`) | PASS — `Unable to validate email address: invalid format`. |
| Short password (`short`) | PASS — `Password should be at least 8 characters.` |
| Password mismatch | Client-only; covered by unit suite + live UI below. |

## UI matrix (Playwright Chromium on preview, real cookie session)

| Case | Result |
|---|---|
| Signup page renders | PASS — heading, fields, requirements, recovery link. |
| Invalid email submit | PASS — native `type=email` validity blocks submit. |
| Short password submit | PASS — `minlength=8` blocks submit. |
| Mismatch submit | PASS — alert `Passwords do not match. Re-enter both fields.` |
| Happy-path signup (`?next=/workspace/teams`) | PASS — lands on `/workspace/teams`; header shows Workspace + Account menu; cookie `sb-knniommcyyhbyiwljisk-auth-token` present (SameSite=Lax; browser-set, not httpOnly — expected for `@supabase/ssr` browser client writes). |
| Resend confirmation | NOT EXERCISED — no pending-confirmation state under confirmation-OFF. |
| Confirmation link (valid/expired) | NOT EXERCISED live — preview origin not allowlisted for email redirects (02). Fail-closed invalid-code covered in 05. |
| Confirmation-ON vs OFF | Only OFF is live. ON is **not claimed**. |

## Account-state evidence

- Browser run UID recorded then deleted in cleanup (`DISPOSABLE_REMAINING=0`).
- Session issuance proves preview talks to Esports project `knniommcyyhbyiwljisk`.
