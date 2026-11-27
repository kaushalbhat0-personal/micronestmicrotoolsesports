# P3 Publishing and Moderation Boundaries

## Publishing (validation-complete, persistence-disabled)

- Draft contract: strict Zod + ends-after-starts refinement; protected keys
  (ids, owner identity, lifecycle internals, verification flags) rejected.
- Update contract: same base minus `slug`/`gameKey`, same refinement —
  identity can never move through an edit.
- Unpublish contract: slug + optional ≥10-char reason (audit seed for the
  future queue; stored nowhere today).
- Writer: `TOURNAMENT_WRITES_ENABLED: boolean = false` (audit-pinned);
  validated ops throw `TournamentWriteDisabledError` before any table
  touch. The below-gate SQL shape is intentionally unspecified — the
  ownership model (organizer ref vs organization authority) is undecided,
  and specifying statements now would assume it.
- Form foundation (`TournamentPublishForm`): all draft fields, native
  constraints mirroring Zod, no action, disabled submit, boundary notice.
  Unrouted: no organizer route ships until organizer identity + moderation
  decisions land (see 08).

## Editing / unpublishing UX rules (for the enabled future)

- Editable: title, description, region, format, dates, timezone, fee,
  prize, contact, eligibility, registration URL, close date. Locked:
  slug, game. No ownership/org controls, ever.
- Unpublish is terminal-state adjacent: republishing a new listing beats
  silent reactivation (same rationale as D1-D12 post lifecycle).

## Moderation boundary (nothing approved — nothing built)

- No verification pipeline: `verified` frozen false, trust note on every
  organizer surface, no badges.
- No report queue: detail states reporting arrives later and that no
  listing implies endorsement. No moderator permissions modelled; no
  "report" button that leads nowhere.
- Required decisions before enablement: schema/ownership acceptance,
  organizer-permission model, report retention/visibility (D1-D9 analogue),
  reviewer SLA, verification semantics (D1-D7 analogue).
