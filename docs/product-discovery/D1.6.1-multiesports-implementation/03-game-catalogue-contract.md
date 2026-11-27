# 03 — Game Catalogue Contract (stable keys + how to add a title)

## Stable key contract

- Keys match `^[a-z0-9-]{2,24}$` (DB CHECK + `gameKeySchema`); lowercase
  canonical; aliases (case/whitespace-insensitive) resolve to the key.
- `SUPPORTED_GAME_KEYS = ['bgmi']` is the launch freeze, asserted by
  `multititle-contract.test.ts`. Identity triple frozen:
  `bgmi / Battlegrounds Mobile India / BGMI`.
- Tri-state gating: supported (creation allowed) · planned (`mlbb`,
  recognized, rejected with planned-title messaging) · unknown (fail-closed
  `undefined`, never throws). Format validation (`gameKeySchema`) is separate
  from activation gating (catalogue) — that separation is the extension point.

## Adding a future title (no canonical-identity change, per D-G1-09)

1. `INSERT INTO games(key,…)` + `is_active` management (migration).
2. Per-game CHECK/validation: roles, `region_code` set, play-modes
   (migration CHECK + Zod vocabulary + region-dispatcher entry).
3. Decide team-shape impact under D1-D2 (new team rows per game under the
   current proposal — a decision, not a default).
4. Extend RPC filters and search parsers allowlists (they ignore unknown enums today).
5. Tests: resolution, rejection of unapproved use, vocab isolation.

## What was deliberately NOT done

No game records seeded (no Valorant/Free Fire/Counter-Strike rows, no code
references beyond the D1.6 examples of what is excluded). Catalogue tests assert
`valorant` stays unknown.
