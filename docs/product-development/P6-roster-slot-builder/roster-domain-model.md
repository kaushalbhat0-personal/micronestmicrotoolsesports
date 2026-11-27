# Roster Domain Model (P6)

Pure module: `src/features/tools/roster/roster.ts` (+ `schema.ts` at the
boundary). Immutable updates, no I/O, no dates, no randomness. Every mutating
op returns a new `RosterState` or throws `RosterError` with a stable `code`.

## Types

- `RosterConfig`: `teamName` (≤40, nullable), `gameKey` (`"bgmi"` only),
  `starterSlots` (1–6), `substituteSlots` (0–6).
- `RosterPlayer`: `id` (`p<n>` op handle only — never exported),
  `displayName` (preserved verbatim), `playerId` (nullable 4–32),
  `role` (BGMI role or `null` = Flexible), `notes` (nullable ≤140),
  `assignment` (`{kind, index}` 0-based, or `null` = bench).
- `RosterState`: `{ config, players, nextSeq }`. Cap: 12 players.

## Operations

| Op | Rule |
|----|------|
| `createRoster` | Rejects planned (`mlbb` → `PLANNED_GAME`) and unknown (`UNSUPPORTED_GAME`) keys distinctly; validates slot counts and team-name length. |
| `addPlayer` | Zod-validated first; rejects duplicate normalized names (`DUPLICATE_NAME`), duplicate IDs (`DUPLICATE_PLAYER_ID`), roster-full (`ROSTER_FULL` at 12). New players start unassigned. |
| `updatePlayer` | Same duplicate re-checks excluding self; `clearPlayerId`/`clearNotes` flags for explicit erasure (patch absence ≠ erasure). |
| `removePlayer` | Unknown id → `UNKNOWN_PLAYER`; slot freed implicitly. |
| `assignPlayer` | Target validated (`SLOT_OUT_OF_RANGE`, incl. zero-sub plans); occupied-by-other → `SLOT_OCCUPIED` naming the holder (never overwritten); same player holding another slot is *moved*, so nobody holds two slots. |
| `unassignPlayer` | Already-bench → `NOT_ASSIGNED`. |
| `configureSlots` | Grow/rename free; shrink below occupancy → `CONFIG_SHRINK_BLOCKED` naming blockers. Nothing is ever silently dropped. |

## Normalization (documented)

`normalizeDisplayName`: trim → collapse `\s+` to one space → lowercase.
`"  Nova   X "` ≡ `"nova x"`; `"NovaX"` ≢ `"Nova X"` (different token
shapes — deliberate, documented, tested). Player IDs normalize by
trim + lowercase. Display values are always preserved verbatim.

## Completeness

`describeCompleteness` → `{ status, startersFilled, substitutesFilled,
unassignedNames, emptyStarterSlots, issues }`. `empty` = no players;
`partial` = any `STARTER_SLOT_EMPTY` / `UNASSIGNED_PLAYER` / `NO_PLAYERS`
issue; `complete` = starters full and zero issues. Empty substitute slots
are *not* an issue — substitutes are optional by design.

## Summary

`buildRosterSummary` is deterministic: slots in index order, unassigned
sorted by normalized name (id breaks ties). Contains no internal ids, no
metadata, no approval language; header and footer label it a user-created
plan that implies no organizer approval or player verification.
