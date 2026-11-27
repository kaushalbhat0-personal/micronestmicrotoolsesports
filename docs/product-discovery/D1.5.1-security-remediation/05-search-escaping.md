# 05 — Search Escaping (F-T06)

## Reference

Frozen G1 implementation: `20261110000007_g1_public_projection.sql:92-101`
(trim → `left(...,120)` → escape `\`, `%`, `_` → `... ESCAPE '\'`).

## Change

`search_teams` (`M3 §H`, same signature/defaults) now:

- trims all three inputs; empty → NULL (no filter);
- lowercases game/region (stored values are lowercase; G1 parity);
- caps the query at 120 chars, escapes `\` → `\\`, `%` → `\%`, `_` → `\_`;
- matches with `ILIKE ... ESCAPE '\'` on `name`/`slug`;
- clamps limit 1..60 (unchanged) and offset 0..1000 (new G1-parity DoS guard).

Result columns, `is_public` predicate, `member_count` derivation, and
anon+authenticated EXECUTE grants are unchanged. `get_team_by_slug` uses
equality (no wildcards) and is untouched.

## Tests

`team-security-boundary.test.ts` → "F-T06" block: `%`/`_`/`\` vectors, quote
pass-through (parameterized, no dynamic SQL), empty/ordinary terms, 120-char
cap, SQL-pattern assertions, column/predicate preservation.

Execution note: pure-unit + static. Replay must confirm a stored team named
`100%_x` is found only by the literal query, not by `%`.
