# 07 — Tests and Regression (P14-D12)

## Automated

| Check | Result |
|---|---|
| Typecheck | PASS |
| Lint | PASS (0 errors) |
| Production build | PASS — includes `/onboarding/profile` |
| Unit suite | PASS — **104 files / 1025 tests** |
| Redirect allowlist + signup default | PASS (`redirect.test.ts`) |
| Onboarding status + access policy | PASS (`onboarding-status.test.ts`) |
| Auth form labels | PASS (`signup-form.test.tsx`) |
| Teams security boundary (`email_confirmed_at`) | PASS (unchanged contract) |
| Teams workspace writer switch | PASS (`WORKSPACE_WRITES_ENABLED=true`) |

## Live Auth probe (disposable)

- Project `knniommcyyhbyiwljisk`: signup returned session +
  `email_confirmed_at` immediately → confirmation-disabled behavior.
- Disposable probe user deleted (`cleaned`).

## Not executed in this lane (documented limitations)

- Full browser cookie-session E2E against preview (P14-D11 covered prior auth;
  D12 focused on implementation + unit regression).
- G1 integration lanes (self-cleaning) — not re-run this turn; unit/security
  contracts for Teams + projection remain green. Recommend running G1-1..7
  before production promote.
- Direct RPC bypass for a future verification table — N/A (table not created).
- Pending/verified/rejected restrictions — not live statuses (see 05).

## Cleanup

- Probe disposable deleted.
- No production deploy.
- No migration apply.
- Worktree preserved (P14-D10 + D12 changes uncommitted unless user commits).
