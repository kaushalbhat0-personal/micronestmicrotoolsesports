# 03 — Cookie-Session Verification (P14-D7)

## Identities

Stamp: `20261113005330`  
Emails: `p14d7.{owner|captain|cocap|player|sub|outsider}.20261113005330@example.invalid`  
Created via Auth Admin API; passwords held only in temp files (wiped after cleanup).  
`ensure_app_user` called per identity before browser/RPC work.

## Mechanism

Browser `createBrowserClient` (`@supabase/ssr`) `signInWithPassword` on `/login` → httpOnly auth cookies → middleware `getUser()` refresh → server actions `createClient()` / `auth.getUser()`.

**Not** localStorage-only auth.

## Results

| Check | Expected | Actual |
| --- | --- | --- |
| Login as owner | Session established; redirect to `next` | PASS → `/teams/new` |
| Navigate authenticated | Session preserved | PASS (`/teams`, `/workspace/teams`, settings) |
| Server action identity | Owner create/settings succeed | PASS |
| Logout `/logout` | Session cleared | PASS → home; `/workspace/teams` shows Sign in |
| Missing session | Safe fail / sign-in prompt | PASS |
| Login as player | Cookie session for member role | PASS |
| Expired session | Fail safely | Not force-expired; logout + anon cover missing session |

## Routes exercised

- `/login?next=/teams/new`
- `/login?next=/workspace/teams`
- `/logout`
- Authenticated `/teams/new`, `/workspace/teams`, `/workspace/teams/{id}/settings`

## Notes

- Password grant confirmed against Esports project before browser login.
- Preview SSO share cookie is separate from Supabase auth cookies.
