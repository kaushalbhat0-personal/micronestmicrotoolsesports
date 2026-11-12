# Game Compatibility (P6)

## Position

Launch: **BGMI only** (`gameKeys: ["bgmi"]`). The directory shows the tool
under BGMI filters; unrelated game filters hide it (platform-wide splitter
behavior unchanged).

## Boundaries inspected before building

- Game catalogue (`src/lib/game-catalog/catalog.ts`): supported = `bgmi`,
  planned = `mlbb`. Roster accepts only what the catalogue supports and
  names the rejection reason (`PLANNED_GAME` vs `UNSUPPORTED_GAME`).
- G1 player-profile vocabulary (`schemas/game.ts`): BGMI roles
  IGL/Assaulter/Support/Scout, optional (null = Flexible); IGN 2–30;
  game-user-id 4–32, owner-private.
- No approved roster size or mandatory role structure exists anywhere in
  G1–P5. Therefore slot counts are **user-configured** (starters 1–6,
  substitutes 0–6) and the UI states they are "your own plan, not an
  official tournament rule."

## Adapter rule (no hardcoding)

BGMI specifics live in one place: `schema.ts` exports
`ROSTER_BGMI_ROLES` + `resolveRosterGameKey`. The generic primitives
(`SlotKind`, `SlotRef`, assignment mechanics) know nothing about BGMI.
The role list is a deliberate local copy of the G1 vocabulary — not an
import — preserving P5 feature isolation (tools never import
player-profile internals). Adding a game = new key in
`SUPPORTED_ROSTER_GAME_KEYS` + its vocabulary + a dispatching schema;
never reinterpreting the BGMI list as universal.

## Not claimed

No seed of extra games, no invented BGMI squad-size rule, no role
mandates, no organizer-format enforcement.
