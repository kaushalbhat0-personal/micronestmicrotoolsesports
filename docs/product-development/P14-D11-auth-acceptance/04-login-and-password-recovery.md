# 04 — Login and Password Recovery (P14-D11)

## Login (API + preview UI)

| Case | Result |
|---|---|
| Successful login | PASS — API session issued; UI login with `?next=/workspace/teams` returns to workspace with Account menu. |
| Incorrect password | PASS — API `Invalid login credentials`; UI alert `Could not sign in…`. |
| Unknown email | PASS — same generic `Invalid login credentials` (no enumeration). |
| Logout | PASS — `GET/POST /logout` clears session; header returns to Log in / Sign up. |
| Session persistence after refresh | PASS — Account menu still present after reload; auth cookie retained. |
| Public ↔ protected navigation | PASS — anonymous `/workspace/teams` shows Log in CTA; after login Workspace/Account appear. |
| Expired session | Covered indirectly: logout leaves anonymous state; protected workspace no longer shows authenticated chrome. |

## Password recovery

| Case | Result |
|---|---|
| Recovery email request (UI) | PASS — `/forgot-password` renders; submit shows generic status/alert (success path: “If an account exists…”). |
| Generic non-enumeration (unknown) | PASS — `resetPasswordForEmail` for never-seen address returns no error. |
| Known disposable `.invalid` / `.example.com` outbound | CONDITIONAL — GoTrue rejects reserved/non-routable domains for **existing** users (`Email address … is invalid`) while unknown addresses still return success. Not a production-domain oracle; real MX domains expected for SMTP send. |
| Recovery link callback on preview | NOT EXERCISED — `generateLink(recovery)` with preview `redirectTo` is overridden to production site URL (02). |
| Expired recovery link | Fail-closed path covered via invalid callback codes (05); live expired recovery token not mintable for preview. |
| Password update | No dedicated update form in the P14-D10 flow. Admin password update + login with new password: PASS (API). |
| Login with updated password | PASS (API). |

## Restricted account states

| Case | Result |
|---|---|
| Unverified user cannot sign in | PASS — `Email not confirmed`. |
| Unverified user cannot create a team | PASS by composition — no session ⇒ cannot call authenticated `create_team` RPC (RPC itself requires `email_confirmed_at`, enforced in Teams migration contract tests). |
| Banned/suspended user | PASS — `User is banned`. |
| Owner/captain authorization | Untouched — no Teams/RLS/authz files in P14-D10 change set; G1/Teams unit security suites still green. |
