# 03 — Recruitment & Privacy Contract (D1-D12 v1 proposal)

Approve line-by-line, or defer each line with recorded risk acceptance.
Unapproved lines stay fail-closed (no captain writes possible today).

## Post lifecycle

- States: `open → paused → open`, `open/paused → closed`, `open → filled`
  (filled when slots confirmed). `closed`/`filled` are terminal (reopen needs a
  new post — prevents silent reactivation of stale applicant pools).
- Expiry: `expires_at` defaults +30d; posts past expiry are treated as closed
  for new applications (automation vs app-enforced hiding is an implementation
  choice with identical product semantics).
- Drafts: out of v1 (a post is published on creation).

## Application lifecycle

- States: `applied → shortlisted → accepted | declined`; `applied |
  shortlisted → withdrawn` (applicant only). `accepted/declined/withdrawn`
  terminal. Only the withdraw transition exists today.
- Duplicates: partial-unique anti-double-active preserved. Re-apply after
  terminal state: one re-application per post per 30 days (prevents
  harassment loops while allowing genuine second chances).
- Withdrawal: applicant-only, status-only, clears nothing else; note edits
  require withdraw + reapply until an edit flow is approved.

## Captain decisions (design, not built)

- Only post-captains (matrix `02`) decide their post's applications, via a
  dedicated RPC that checks captaincy + applicant active status + writes an
  audit record. `accepted` enqueues the roster insert atomically (idempotent on
  `PK(team_id,user_id)`). Direct decision writes stay trigger-blocked (FWD-01).

## Visibility matrix (approve explicitly — privacy core)

| Data | Applicant | Post captain | Other members | Public / anon |
|---|---|---|---|---|
| Own application + history | yes | — | no | no |
| Applicant note + id on own post | — | yes | no | no |
| Application existence/status elsewhere | no | no | no | no |
| Roster `user_id`s | own only | team roster | team roster | no |
| Team public card | yes | yes | yes | masked RPC only |

Open point: teammate visibility of roster ids is collaboration-necessary but
unapproved — confirm or narrow here.

## Deletion cascades (current, confirm)

Team delete → members + posts + applications cascade. Post delete →
applications cascade. Reports follow D1-D9, not this table. Application rows
are never deleted except via these cascades (withdraw ≠ delete).

## Auditability

Every captain decision must be auditable (who decided what, when). Until the
decision RPC exists, there is nothing to audit and nothing to forge — the
withdraw-only trigger is the interim guarantee. F-NEW-01 fix (insert
`decided_*` nullness) is part of this contract's acceptance.
