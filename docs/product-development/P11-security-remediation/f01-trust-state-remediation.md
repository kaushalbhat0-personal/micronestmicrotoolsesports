# F-01 trust-state remediation

## Finding restated

The P9 `organizers admin update` policy plus the table-level `UPDATE` grant
permit any owner/admin row-holder to write any column — including
`trust_state` — through direct SQL/PostgREST. Verification separation rested
on the application boundary alone, so a public `confirmed` indicator would
have been forgeable by the organizer.

## Fix: `20261113000001_p11_f01_trust_guard.sql` (proposal, unapplied)

A `BEFORE INSERT OR UPDATE` trigger,
`public.prevent_unprivileged_trust_change()` (`security invoker`,
`set search_path = ''`, revoked from all API roles):

- **INSERT:** any `trust_state` other than `not_submitted` raises. No caller
  — member or moderator — can mint a pre-confirmed row; confirmation is only
  ever a reviewed transition.
- **UPDATE:** any `trust_state` change where `not public.is_super_admin()`
  raises. `is_super_admin()` is the D1/D1.5.1 check (platform_admins
  membership AND active `app_users` row; fail-closed for missing, suspended,
  and anonymous callers), so forged self-confirmation through PostgREST
  raises at the database even though RLS and grants would permit the row
  update.
- **Fail-closed without moderator authority:** when `platform_admins` is
  empty (or the authority decision stays unapproved), the trigger blocks
  everyone. There is no fallback path, no role exception, no service-role
  shortcut in the function body.
- **Additive only:** one function + one trigger + revokes. No G1–P9 table,
  function, policy, grant, or storage object touched; no policy and no grant
  added (pinned by `f01-trust-guard.test.ts`).

## What is deliberately out of the trigger

- **Reviewer identity and timestamps** are not stored on `organizers` — there
  are no such columns, so there is nothing to forge there. Reviewer identity
  for verification decisions lives in the queue audit
  (`verification_cases.reviewer_id`, nullable until decided), never in
  caller input (strict schemas reject `reviewerId`).
- **`is_public`** is not frozen: hiding a listing removes visibility (the
  fail-safe direction) and unpublish flows need it. A moderator-only
  visibility rule may tighten this later with approval.
- **Public projection unchanged:** the masked RPCs read `trust_state` as
  before; only unprivileged writes are blocked.

## Residual risk (honest)

- The trigger executes only after the migration is applied; until then the
  application boundary is the sole guard (switches OFF, so no writes exist).
- `TRUNCATE` is trigger-exempt (revoked from API roles; service-role only) —
  same standing note as D1.5.1, unchanged by P11.
- Runtime firing under real JWTs is unverified (see
  `runtime-verification-strategy.md`); static review + simulated tests are
  the evidence level of this phase.

## Evidence

`src/features/moderation/tests/f01-trust-guard.test.ts` (8 tests): trigger
shape, fail-closed property, hardened convention, additive-only proof,
creation/update forgery rejection, `canTouchVerification() = false` for all
roles.
