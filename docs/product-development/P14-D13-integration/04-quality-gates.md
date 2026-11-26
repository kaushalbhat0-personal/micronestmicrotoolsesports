# 04 — Quality Gates (P14-D13)

Run against the exact integration source before commit.

| Gate | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | PASS |
| ESLint | PASS (0 errors) |
| Production build | PASS — routes include `/signup`, `/onboarding/profile`, `/auth/callback` |
| Full unit suite | PASS — 104 files / **1025** tests |
| Auth onboarding / redirect tests | PASS (`redirect.test.ts`, `onboarding-status.test.ts`, `signup-form.test.tsx`) |
| Teams regression | PASS (`team-security-boundary.test.ts`, `workspace-writer.test.ts`) |
| G1 directory regression | PASS — G1-4 integration 13/13 |
| Secret scan on candidates | PASS — only env **names** in docs (values withheld); no raw secrets |
| LMS reference exclusion | PASS — no LMS refs in staged paths |
| Profile statuses limited | PASS — live set `not_started\|incomplete\|complete` |
| No verification DB bypass | PASS — no verification table/migration; `isVerified` always false |
| `create_team` / RLS | PASS — migration text + no supabase diff |
| Write switches | PASS — Workspace true; others false |
