# 02 — Game Catalogue (GATE D1.2)

## Sources inspected

- Legacy `ref/legacy-project/application/src/config/games/catalog.ts` (10 slugs, alias map, MLBB excluded)
- Greenfield `supabase/migrations/20261110000006_g1_game_catalogue.sql` (`games(key,name,short_name,is_active)`, BGMI seed) + `src/features/player-profile/schemas/game.ts` (BGMI region/role vocabularies)

## Implementation

`src/lib/game-catalog/catalog.ts` + `catalog.test.ts`:

- `SUPPORTED_GAME_KEYS = ['bgmi']`; `SUPPORTED_GAMES` identity matches DB seed (`Battlegrounds Mobile India` / `BGMI`).
- `PLANNED_GAME_KEYS = ['mlbb']` — recognized but rejected (never resolved).
- Aliases normalized (trim + lowercase): `bgmi`, `pubg-mobile`, `battlegrounds mobile india`.
- `getGameByKey` → identity or `undefined` (never throws); `isSupportedGameKey` / `isPlannedGameKey` / `resolveSupportedGameKey` for creation/validation gates.
- Slugs never drive auth/entitlement; never treated as DB FKs in code (FK lives in SQL only).

## Compatibility

- `games(key)` unchanged; `player_game_profiles(game_key)` unchanged; no G1 contract edit.
- New `teams(game_key)` / `recruitment_posts(game_key)` FKs reference same catalogue (see `05`).
- Unknown titles rejected at boundary; MLBB explicitly not enabled.

## Tests / acceptance

`catalog.test.ts` (4): alias resolution, supported-only, planned-without-enable, never-throw. PASS.
