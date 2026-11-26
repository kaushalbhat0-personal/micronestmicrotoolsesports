# 05 — Callback and Redirect Security (P14-D11)

Shared allowlist: `src/lib/auth/redirect.ts` (`safeNextPath`). Used by
`/login`, `/signup`, and `/auth/callback`.

## Preview route probes (bypass-authenticated fetch, follow redirects)

| Probe | Final path | Result |
|---|---|---|
| `/auth/callback` (no code) | `/workspace/teams` | PASS — default next |
| `/auth/callback?next=/workspace/teams` | `/workspace/teams` | PASS — valid internal |
| `/auth/callback?next=https://evil.example` | `/workspace/teams` | PASS — external rejected |
| `/auth/callback?next=//evil.example` | `/workspace/teams` | PASS — protocol-relative rejected |
| `/auth/callback?code=invalid-code-xyz` | `/login?error=link-expired&next=%2Fworkspace%2Fteams` | PASS — malformed/expired fail-closed |
| `/auth/callback?code=invalid&next=/workspace/teams` | `/login?error=link-expired&next=%2Fworkspace%2Fteams` | PASS |
| `/login?next=/workspace/teams` | stays login with next preserved | PASS — form sanitizes on submit |
| `/login?next=https://evil.example` then successful login | `/workspace/teams` (no evil host) | PASS — browser test |
| `/signup?next=https://evil.example` | query may remain on form URL; submit uses `safeNextPath` | PASS — no open redirect on success |
| Missing callback params | defaults to workspace | PASS |

## Unit / source contract

- `redirect.test.ts` unit suite green (part of 1018 unit tests).
- Blocks `:`, `//`, backslash, whitespace, and non-allowlisted paths.

## Open redirect verdict

**No open redirect observed** on callback or post-login/post-signup navigation.
External/`next` values never leave the preview origin as a Location target.
