# P2 Owner Workspace Design

## Access model

- Authenticated surface only (`force-dynamic`, `noindex, nofollow`).
  Signed-out callers get a sign-in prompt — never a redirect loop, never an
  enumeration signal.
- Every route resolves identity from the verified session inside the server
  operation. No route accepts a user ID; no filter, query, or body field
  scopes the data.
- Invalid `[id]` segments (non-uuid, hostile strings) resolve to `notFound`
  without touching the database. Invisible teams (missing, others-private,
  RLS-denied) resolve to the identical `notFound` — no existence oracle.

## Management basis (proposed matrix `02`, AWAITING approval)

Each managed team carries the caller's OWN basis, resolved server-side:

- **owner** — session matches `owner_user_id`/`created_by` (either root;
  roster row not required). Full editable-field scope in UI.
- **captain** — member row `role='captain'` only. Same editable-field scope.
- **member** — everything else, including `co-captain` (explicitly
  rightless). Read-only: settings route shows a notice instead of a form.

The basis badge on every card states what it means ("Owner — you manage
this team" / "Captain — you manage this team" / "Member — read-only"), and
`PermissionNote` repeats the unavailable capabilities with their blockers.

## States

| State | Render |
| --- | --- |
| Signed out | `WorkspaceSignInPrompt` |
| Transport / pre-migration / suspended (indistinguishable) | `WorkspaceUnavailable` (role=alert + retry) |
| Zero managed teams | `WorkspaceEmpty` + link to `/teams/new` + creation-boundary note |
| Loading | `WorkspaceSkeleton` (announced region) |
| Member on settings | Read-only notice (no form, no disabled form to confuse) |

Suspended callers are deliberately merged into the generic unavailable
state at the route layer (no account-state enumeration); the operation
layer still throws the typed `SuspendedError` for future differentiated
handling after approval.

## Mobile-first

Single-column base everywhere; `sm:grid-cols-2` for settings pairs and
roster cards; `max-w-3xl` container with `px-4 sm:px-6` gutters (narrower
than public discovery — a working surface, not a marketing page);
`truncate`/`min-w-0` on identity rows; labelled controls throughout.
