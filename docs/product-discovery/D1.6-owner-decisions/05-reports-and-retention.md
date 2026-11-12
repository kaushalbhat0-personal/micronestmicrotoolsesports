# 05 — Reports & Retention (D1-D9)

## The choice, plainly

When the reporter deletes their account, their reports either vanish
(`CASCADE`, current) or stay as orphaned evidence (`SET NULL` + snapshot,
recommended). Vanishing protects reporter privacy absolutely but destroys the
evidence for the abuse it alleged — including evidence against others.
Preserving keeps the moderation queue truthful but retains reporter-linked data
past account deletion, which must be disclosed in the retention notice.

## Recommended: (i) + (B)

- Visibility stays reporter-insert-only, reads admin-boundary-only. No
  reporter receipts and no reported-party visibility until a moderation SLA
  (open D-08) defines them — both are explicit follow-up decisions, not silent
  defaults.
- Retention becomes `SET NULL` on the reporter FK plus a reviewer-side evidence
  snapshot (target reference, reason, timestamps) captured before any purge.
  Small FK migration + ops procedure; no broad access; no retention period is
  invented here — the period itself needs legal/product input.

## Consequences of each option

| | (A) CASCADE | (B) SET NULL + snapshot | (C) hard retain |
|---|---|---|---|
| Evidence after purge | lost | preserved | preserved |
| Reporter privacy | strongest | needs notice | weakest |
| Engineering | current | small migration + procedure | scheduler + purge |
| Audit trail | gap | complete | complete |

## Dependency

Account/team deletion flows must reference this decision: deletion is only
"complete" when its report rows have a defined fate. Do not accept the
migration with live reporting until this row of the response sheet is answered.
