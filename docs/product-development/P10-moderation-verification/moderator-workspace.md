# P10 moderator workspace

## Status: DISABLED SHELL (honest, not operational)

Routes (all `force-dynamic`, all `index: false, follow: false`):

- `/workspace/moderation` — index: session check, links to the three queues,
  disabled notice, empty-queue shell.
- `/workspace/moderation/reports` — report queue shell (lists nothing).
- `/workspace/moderation/tournaments` — submitted-listing review shell.
- `/workspace/moderation/organizers` — verification review shell.

## Guarantees (pinned by `src/app/workspace/moderation/routes.test.ts`)

- Session-gated: unauthenticated callers get a sign-in prompt, never queue
  content (there is none).
- No service-role or elevated client in any route module; no direct
  `@supabase/supabase-js` import.
- No `user_id`/`userId` accepted anywhere (identity is session-derived).
- No base-table reads (`.from(`), no mutations, no `.rpc(` calls.
- No operational control: no buttons, no forms, no `"use server"` actions,
  no writer/queue/decision calls. Pages describe what moderators *will* do;
  nothing performs it.
- `MODERATION_WRITES_ENABLED = false` pinned; flipping it breaks the suite.
- Never indexed, never followed; absent from public navigation (ordinary
  users are not led to an operational-looking tool).

## What the shell provides today

- Review-queue information architecture (where reports, submissions, and
  verifications will queue).
- Entity-context, decision-history, and explicit approve/return placements
  are specified in the domain docs, not rendered — rendering them before the
  authorization boundary exists would misrepresent the system.
- Sensitive actions will require confirmation dialogs; that requirement is
  recorded here so the building phase does not skip it.

## Non-goals (explicit)

- No moderator provisioning UI (platform_admins membership is out of band).
- No SLA display (no approved SLA to display).
- No takedown tooling beyond the specified unpublish/archive decisions.
- No reporter-identity display anywhere in future UI without the approved
  visibility rule.
