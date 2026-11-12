# P10 tournament moderation workflow

## Approved lifecycle

`draft → submitted → published → unpublished → archived`

| From → To | Allowed by | P10 status |
| --------- | ---------- | ---------- |
| draft → submitted | owner, admin, editor | validated; persistence gated OFF |
| submitted → published | moderator | **disabled** (authority unresolved) |
| submitted → draft (return) | moderator | **disabled** (authority unresolved) |
| published → unpublished | owner, admin, moderator | validated; persistence gated OFF |
| unpublished → published | moderator | **disabled** (no silent reactivation) |
| unpublished → archived | moderator | **disabled** (retention rule pending) |
| published → archived | moderator | **disabled** (retention rule pending) |

Every other pair — including `draft → published` — is rejected in code
(`canRoleTransition` + `findTransition`) and in SQL (the 06 trigger raises).

## Rejection handling (P10-06, proposed)

Rejection is `submitted → draft` **with a reason** stored in the moderation
decision audit (proposed append-only rows), never as a stored `rejected`
lifecycle value. The organizer sees the reason for their own returned
submission; the public enum stays small; the audit trail keeps who decided,
when, and why. The 06 trigger currently blocks this transition (moderator
reserved) — the approving migration relaxes exactly that path plus
`submitted → published`.

## Trigger ordering (verified statically)

On `tournaments`, `BEFORE UPDATE` fires `trg_tournaments_lifecycle` before
`trg_tournaments_updated_at` (alphabetical firing order for same-level
triggers; disjoint concerns — lifecycle guard vs timestamp). Order cannot
affect correctness: the lifecycle guard either passes the row through or
raises before the timestamp trigger runs.

## Axis separation (non-negotiable)

- A **verified organizer does not bypass** tournament moderation: every
  listing publishes only through the moderator path, regardless of trust.
- A **published tournament does not verify** its organizer: `verified` stays
  frozen `false` in the public projection.
- An **organizer cannot touch another organizer's listing**: tournament RLS
  joins `organizer_members` on the row's own `organizer_id`; update schemas
  omit `organizer_id/slug/gameKey` so cross-organizer moves are
  unrepresentable.

## Known gap: same-state edits to published rows (F-02)

The lifecycle trigger passes through every same-state update, and the member
update policy covers all roles — so a member could edit a live listing's
prize, dates, fee, or registration URL without re-review. The approving
migration (or the launch gate) must choose one of:

- (a) **Strict:** any field edit on a `published` row forces
  `published → unpublished` + resubmission; or
- (b) **Reviewed-diff:** a declared safe-field list (e.g. contact
  instructions) stays editable; all other edits force resubmission.

P10 defaults new code to the strict reading and records option (a)/(b) as
Stage C gate C-4. Nothing publishes until it is resolved.

## Unpublish and archival authority

- Unpublish is the single organizer-reachable terminal transition (owner,
  admin; editors excluded), preserving history while removing visibility.
- Republishing (`unpublished → published`) is moderator-only: silent
  reactivation is not permitted.
- Archival is soft and terminal: directory visibility removed, rows and
  decision history preserved, no delete policy or grant anywhere.
