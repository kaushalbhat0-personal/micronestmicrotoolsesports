# P10 next-phase recommendation (P11)

## Smallest safe P11 slice

Do NOT attempt launch in P11. The highest-value, lowest-risk slice is the
**moderation-authority + queue-foundation proposal**:

1. Owner review of the nine P10 proposals (approve / amend / reject each;
   partial approval is fine — gates are per-capability).
2. Draft (not apply) the queue-table DDL + RLS proposal:
   `moderation_reports`, `moderation_reviews` (or decision audit),
   `verification_cases` + audit tables, with the F-01 column guard and the
   F-02 published-row rule included as first-class clauses.
3. Draft the F-03 founding-owner self-insert path as part of the same review.
4. Specify the queue retention/visibility rule and reviewer SLA so P12 can
   build against a frozen target.

## What P11 must NOT do

- Apply any migration without the separately authorized disposable replay.
- Flip any kill switch (all three stay OFF through P11).
- Add public report buttons, evidence uploads, or media surfaces.
- Touch the frozen P3 projection or the G1–P9 migrations.

## Entry criteria for eventual launch work (P12+)

Owner approval of P10-04 (authority + SLA + retention) AND P10-05
(evidence policy) AND the disposable-replay evidence for 05/06
(A-1…A-5). Until all three hold, launch work stays in proposal form.
