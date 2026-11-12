# P3 Tournament Domain Contracts

## Game-agnostic core, game-specific boundaries

- Status (`upcoming/ongoing/completed`) derives from instants only — never
  from game rules. `deriveStatus` takes explicit `nowMs` (deterministic,
  testable); non-finite inputs fail closed to `completed`.
- Participation format (`team/individual/both`) is vocabulary, not
  enforcement: team-size coherence is validated (`min ≤ max`, 1–10), roster
  rules are not invented.
- Lifecycle (`draft/published/unpublished`) is vocabulary for the proposal;
  only `published` rows are publicly readable, and the registration
  indicator additionally requires an upcoming event inside its window.
- Per-game validation applies at the reader for known games (BGMI region
  vocabulary, mirroring P1); unknown games pass through to zero rows.
  Eligibility `regionCodes` reuse the BGMI vocabulary type today — new
  titles add their own vocabulary, never reinterpret this one.

## Money

Minor units + ISO-4217 code, 0 ≤ amount ≤ 10¹². Null = "Not disclosed"
(rendered literally); zero fee = "Free entry". Formatting via
`Intl.NumberFormat` with a plain fallback. No arithmetic, no conversion,
no totals.

## Time

Instants stored/compared as ISO-8601 UTC; `timezone` is display-only IANA.
Validation by `Intl.DateTimeFormat` construction (ICU-version-proof —
`supportedValuesOf` omits `Asia/Kolkata` on some builds; construction
accepts it). Formatting fails closed to the ISO string, never throws.

## Organizer

`{ kind: independent | organization, name, slug | null, verified: false }`.
The `false` is literal in Zod and guarded in mapping: a `verified: true`
row fails closed. Kind changes display copy only — zero authority.

## Registration

External-only. URL rules: https, ≤2000 chars, no credentials, hostname
required, handed off verbatim with `rel="noopener"`. Contact instructions
≤500 chars plain text. Internal registration is a reserved type, never
accepted by any schema.
