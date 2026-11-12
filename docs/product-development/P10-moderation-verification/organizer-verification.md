# P10 organizer verification workflow

## States

`not_submitted → submitted → under_review → confirmed | rejected`, plus
`confirmed → expired`. Re-verification re-enters at `submitted` from
`rejected` or `expired`; history is preserved, never rewritten.

Only `confirmed` renders a confirmation indicator. Every other state renders
`Unverified` + the exact state label + the public note from
`organizerTrustNote()`.

## Evidence

Declared categories (policy review only — no intake exists):
`business_registration`, `event_history`, `social_presence`,
`community_vouch`, `direct_contact`.

Rules:
- Evidence is reviewed **manually** (P10-05). No automated checks, no scoring.
- **Domain ownership alone is never legitimacy.** A reachable website, a
  matching name, or a self-declared link is not verification and is never
  presented as such.
- Evidence lives in **private storage only**, visible to assigned reviewers.
  It appears in no projection, no reader, no component. No evidence upload
  system exists until storage, access, and retention policy is approved.
- Retention: evidence and review records persist per the approved retention
  rule (duration still open — see `deferred-decisions.md`); purging follows
  the rule, never ad-hoc deletion.

## Who can do what

| Action | Owner | Admin | Editor | Moderator |
| ------ | ----- | ----- | ------ | --------- |
| Submit for verification | yes (disabled) | yes (disabled) | never | never |
| Review / confirm / reject / expire | never | never | never | yes (disabled) |
| Approve own organizer | — | — | — | **never, even for moderators** |

Submission is owner/admin only (editors never submit). Review is moderator
only. Self-approval is impossible by construction: the approving migration
must exclude target-organizer members from review assignment, and
`canTouchVerification()` returns false for every role including moderator
until that migration lands.

## Rejection, re-verification, expiry

- **Rejection** moves `under_review → rejected` with a reason the organizer
  can see. Re-verification re-submits from `rejected`; prior rejections stay
  in the audit trail.
- **Expiry** moves `confirmed → expired` under the approved retention rule
  (e.g. periodic re-check). An expired confirmation renders as unverified.
- **Reviewer audit:** every transition appends `(organizer, from, to,
  reason, evidence categories, timestamp)`. Audit rows are append-only;
  organizers see outcomes + reasons for their own organizer; reviewer
  identity is never exposed to organizers.

## Database gap carried from the migration review

Finding F-01: the 05 `organizers admin update` policy + table-level UPDATE
grant do not column-restrict `trust_state`, so the verification separation
currently rests on the application boundary alone. The approving migration
must add one of:

```sql
-- Option A (recommended): trigger freeze for non-moderators
create or replace function public.prevent_trust_state_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (NEW.trust_state is distinct from OLD.trust_state
      and not public.is_super_admin()) then
    raise exception 'trust_state changes require moderator authority';
  end if;
  return NEW;
end; $$;
```

or column-level grant narrowing (`REVOKE UPDATE(trust_state, is_public)` from
`authenticated` + a moderator path). Until then, `confirmed` must never be
rendered as authoritative — and P10 does not render it as such.

## Implementation status

Workflow table (`domain/verification.ts`), submit schema
(`verificationSubmitInputSchema`), and disabled submit op
(`submitVerificationOp`) exist with every transition carrying a
`disabledReason`. No intake, no queue, no approval action is reachable.
