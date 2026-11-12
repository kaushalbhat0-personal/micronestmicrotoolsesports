# P9 tournament publishing lifecycle

## States

`draft → submitted → published → unpublished → archived`

| State         | Meaning                           | Publicly visible                 |
| ------------- | --------------------------------- | -------------------------------- |
| `draft`       | Editable working copy             | never                            |
| `submitted`   | Awaiting moderator review         | never                            |
| `published`   | Live in the directory             | yes (only state the RPCs return) |
| `unpublished` | Taken down, history preserved     | never                            |
| `archived`    | Terminal, discoverability removed | never                            |

Rejection is **not** a stored state: a rejected submission returns
`submitted → draft` with a reason held in the (future) moderation queue.
This keeps the public enum small and the audit trail where it belongs.

## Transition table

| From → To                  | Allowed by              | Status in P9                          |
| -------------------------- | ----------------------- | ------------------------------------- |
| draft → submitted          | owner, admin, editor    | validated, persistence gated          |
| submitted → published      | moderator               | **disabled** (authority unresolved)   |
| submitted → draft (return) | moderator               | **disabled** (authority unresolved)   |
| published → unpublished    | owner, admin, moderator | validated, persistence gated          |
| unpublished → published    | moderator               | **disabled** (no silent reactivation) |
| unpublished → archived     | moderator               | **disabled** (retention rule pending) |
| published → archived       | moderator               | **disabled** (retention rule pending) |

Every other pair (including `draft → published`) is rejected in code
(`canRoleTransition`) and in SQL (trigger raises).

## Who can do what

- **Create drafts**: organizer owner/admin/editor with an active account.
- **Edit drafts**: same roles; slug, game and organizer stay locked.
- **Preview**: client-side from validated inputs (no persistence implied).
- **Submit**: owner/admin/editor (validated; queue disabled, so the
  submission cannot complete yet).
- **Publish/unpublish/archive**: moderator-only; unpublish is the single
  organizer-reachable terminal transition and still requires the migration
  to be applied.

## Moderation boundary

- Moderation is **mandatory**: direct `draft → published` is blocked at every
  layer, so nothing can go live without review once writes enable.
- No moderation queue exists in P9: no report intake, no reviewer SLA, no
  takedown path beyond owner unpublish. Suspicious listings cannot be
  reported in-product yet; the tournament detail page states this plainly,
  and no listing implies endorsement.
- Rejected submissions are represented as returns to `draft`; the reason
  lives in the future queue, not in a status enum.

## Organizer verification vs tournament moderation

Independent axes. Publishing a tournament never confirms its organizer, and
organizer confirmation never auto-publishes tournaments. An unverified
organizer's reviewed, publishable listing goes live as **unverified**.
