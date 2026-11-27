# Teams — Discovery MVP (D1)

First slice of the teams domain: stateless roster-intake pure logic (PORT from legacy Roster-Builder).

## What belongs here (D1)

- `roster/` — pure deterministic intake: normalize, parser, conflicts, slots, output, zod boundaries. No DB, no auth, no billing, no network, no randomness.
- `domain/` — Finder-derived team competition contracts (levels, roles, matching) reimplemented for new model.
- `schemas/` — team / recruitment / application / report zod boundaries.
- `services/` — pure search-param parsers.

## What does NOT belong here (D1 out of scope)

- WhatsApp workflow (`buildRosterWhatsAppMessage` intentionally not carried forward — external share copy belongs to a future UI decision, not domain logic).
- Entitlement/billing gates (`roster-builder-policy.ts`, `claim-actions`) — no billing in Discovery MVP.
- Roster workspace/session UI components — rebuilt only when organizer intake UI is approved.
- Full organizations/brands domains — teams carry nullable `organization_id` (future FK) but no org tables in D1.
- Automated matching scores — forbidden. Only hard-filter + explainable tier.

## Security posture

- All `roster/` + `domain/` + `services/search` functions are pure. No `SupabaseClient`, no `auth.uid()`, no service-role, no fetch, no `Date.now`/`Math.random` in domain (timestamps only in DB defaults).
- Identity comes from session at the future server-operation layer (not in D1 pure logic).
- Contact/third-column values are parsed but never part of identity and never included in copy/CSV outputs.
- No imports from `legacy/`.
