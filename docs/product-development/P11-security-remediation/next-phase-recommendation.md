# P11 next-phase recommendation (P12)

## Smallest safe P12 slice

Do NOT apply migrations and do NOT flip switches in P12. The highest-value,
lowest-risk slice is the **authorization-gated implementation proposal**:

1. Owner review of the two P11 decision inputs: the F-03
   `admin_provisioned` recommendation (approve/reject/amend) and the F-02
   strict default (approve or name the relaxation set).
2. Draft (not apply) the authority migration that activates — and only
   activates — what owners approve: moderator-only queue policies, the
   F-03 self-insert path (narrow: session user inserts exactly their own
   owner row at admin-provisioned organizer creation), and any F-02
   relaxation. Each activation is a separate, independently gated clause.
3. Specify the queue retention/visibility rule and reviewer SLA so the review
   UI can be built against a frozen target in P13.

## What P12 must NOT do

- Apply anything, anywhere (no remote writes, no disposable project without
  separate authorization).
- Flip any of the three kill switches.
- Add public report buttons, evidence uploads, media surfaces, or new product
  features.
- Touch the frozen P3 projection or rewrite G1–P11 migrations.

## Entry criteria for eventual enablement work (P13+)

Owner approval of the F-03 recommendation AND the moderation-authority
package AND disposable-replay evidence for G1 → P9 → P11 (triggers firing
under real JWTs, RLS matrix, grant effectiveness, queue inertness). Until
all three hold, enablement work stays in proposal form.
