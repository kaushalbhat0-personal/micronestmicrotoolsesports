# 07 — Defects and follow-ups

## Blockers for full manual operator acceptance

| ID | Severity | Issue | Smallest fix |
| --- | --- | --- | --- |
| E2E-01 | **Blocker (ops)** | Durable `platform_admins` empty — no operator can open review queue | Owner runs authorized `INSERT` into `platform_admins` for the intended `app_users.id` (see `01`). **Do not** email-auto-grant. |

## Non-blocking defects / hygiene

| ID | Severity | Issue | Smallest fix | Status |
| --- | --- | --- | --- | --- |
| E2E-02 | Low | Integration `afterAll` previously left pending cases when auth delete did not cascade | Delete cases by `player_id` before `auth.admin.deleteUser`; do not delete `app_users` (audit append-only blocks SET NULL) | **Fixed** in `bgmi-ownership-review.integration.test.ts` |
| E2E-03 | Low | Leftover 2 pending cases found mid-acceptance | Deleted cases for `m2b4_%` / `m2b3c_%@example.com` only | **Cleaned** |
| E2E-04 | UX | Moderation index still shows “No review queue is operational” while BGMI queue link is live | Narrow copy update on index shell after owner approves messaging | **Deferred** (product copy; not security) |
| E2E-05 | UX | Anon E2E incorrectly expected BGMI link on moderation index | Expect sign-in gate instead | **Fixed** in `e2e/p15-e2e-acceptance.spec.ts` |

## Explicit non-changes

- No RLS / schema redesign.
- No security weakening.
- No Discord.
- No G1 projection change.
- No durable admin grant performed by this acceptance.

## Follow-up for operator

1. Grant `platform_admins` for the intended account.
2. Manually walk approve + screenshot queue/badge (redact claimed ID if sharing screenshots).
3. Optionally prune leftover `m2b4_*` auth users via Auth admin UI.
