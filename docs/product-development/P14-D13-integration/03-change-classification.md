# 03 — Change Classification (P14-D13)

## Included in integration commit `5a4a158`

1. **Ready P14-D12 implementation** — onboarding route/actions/form; onboarding status + access policy; signup frictionless path; login generic errors; redirect allowlist updates; settings/teams soft links.
2. **Required supporting P14-D10/D11 work** — header shell, signup/login/forgot-password/callback, auth validation/redirect libs, marketing/footer entry points, workspace sign-in prompt updates.
3. **Completed documentation** — `P14-D10-auth-onboarding/`, `P14-D11-auth-acceptance/` (incl. screenshots), `P14-D12-auth-profile-verification/`.

## Excluded (left in worktree / never staged)

| Category | Items | Reason |
|---|---|---|
| Secrets / local-only | `.env`, tokens, service-role keys | Never commit |
| Caches / temp | `.next/`, `test-results/`, probe scripts (removed earlier) | Generated / ephemeral |
| LMS | No LMS paths in candidate set | Confirmed absent via scan |
| Incomplete experiments | None identified beyond stale E2E CTA expectation (not modified) | Out of scope |
| Migrations / Auth config | None present to exclude | No DDL/Auth dashboard edits |

## Intact prior integrations

- Teams platform commit `3f4cc7b` and follow-up docs commits preserved.
- 24 migrations under `supabase/migrations/` unchanged by this commit.
- Hardening migration `20261115000001_p14_teams_grant_hardening.sql` intact.
- Feature switches unchanged (Workspace true; Tournament/Organizer/News/Moderation false).
