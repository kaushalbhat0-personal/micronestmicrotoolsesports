# P12 next-phase recommendation (P13)

## Recommended P13 scope (contingent on approvals)

P13 builds **only** what owners approve in the record, and only after stages
1–2 of the activation sequence pass:

1. **If D-04 + D-06 + D-11 + D-12 approved:** create the activation migration
   file verbatim from `activation-migration-proposal.md` §§2–4 (still
   unapplied), extend the moderation test battery against the created text,
   and prepare the disposable-replay runbook (stage 3) for authorization.
2. **If D-05 additionally approved:** include §3 case policies + verification
   review UI shells (disabled until stage 10).
3. **If D-07/D-08 approved:** include return-to-draft and archival actions
   in the review UI shells (disabled until stage 10).
4. **If D-13 approved:** schedule the retention purge job design (separate
   proposal, never silent deletion).

## What P13 must NOT do

- Apply any migration or perform any remote database operation without
  stage-3/4 authorization.
- Flip any write switch (all three stay OFF through P13).
- Add public report buttons, evidence uploads, media surfaces, appointment
  UIs, or any product feature beyond the approved review shells.
- Relax F-02, widen any grant, or add any policy not in the approved proposal.
- Touch the frozen P3 projection or rewrite any migration.

## If owners approve nothing

The platform holds its current posture indefinitely: read-only directories,
disabled workspaces, inert queue schema, fail-closed triggers in proposal
form. That is a stable, honest end-state — P13 then becomes maintenance and
re-review on demand, not activation.
