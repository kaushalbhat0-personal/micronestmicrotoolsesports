# Competition Domain Model (P7)

Pure module: `src/features/tools/tiebreak/engine.ts` (+ `schema.ts` at the
boundary). Immutable updates, no I/O, no dates, no randomness. Every
mutating op returns a new `TiebreakScenario` or throws `ScenarioError`.

## Types

- `TiebreakCriterion`: `id` (`c<n>`), `name` (verbatim), `weight`
  (−1000…1000, 0 allowed), `direction` (`high` | `low`).
- `TeamEntry`: `id` (`t<n>`), `seq` (entry order), `displayName`
  (verbatim), `values: Record<criterionId, number>` (absent = not entered).
- `TiebreakScenario`: `{ name, criteria[], teams[], cutoff, nextTeamSeq,
  nextCriterionSeq }`. Caps: 24 teams, 8 criteria.
- `TeamStanding`: `total`, per-criterion `contributions` (value, assumed
  flag, contribution), `rank` (competition ranking), `tieSize`, `tieMates`,
  `decidedBy` (or null), `explanation`, `qualification` + note.

## Operations

| Op | Rule |
|----|------|
| `createScenario` / `setScenarioMeta` | Name ≤48; cutoff 0…24 (`0` = off). |
| `addTeam` / `renameTeam` / `removeTeam` | Normalized duplicate check (P6 convention); unknown id → `UNKNOWN_TEAM`; cap → `TOO_MANY_TEAMS`. |
| `setTeamValue` | Bounded int or `null` (null deletes the key → "not entered"); validates both ids first. |
| `addCriterion` / `updateCriterion` | Duplicate check; bad direction/weight → `INVALID_INPUT`; cap → `TOO_MANY_CRITERIA`. |
| `removeCriterion` | Drops the criterion and its values — the op's explicit purpose (runner confirms); never reassigned elsewhere. |
| `moveCriterion` | Swaps priority neighbours; at either end a no-op returning state unchanged (runner disables the button). |

## Error contract

`ScenarioError.code`: `INVALID_INPUT`, `DUPLICATE_TEAM`,
`DUPLICATE_CRITERION`, `UNKNOWN_TEAM`, `UNKNOWN_CRITERION`,
`TOO_MANY_TEAMS`, `TOO_MANY_CRITERIA`, `CUTOFF_OUT_OF_RANGE`.

## Immutability & determinism

Inputs are never mutated (frozen-input test); repeated runs are `toEqual`
identical (test); display order inside ties is entry `seq` — names never
sort anything in the competition path (test uses Zulu/Alpha/Mike ordering).
