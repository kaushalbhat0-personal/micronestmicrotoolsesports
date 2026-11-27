# 01 — Private Identity Storage

## Assessment of `game_user_id`

| Evidence | Finding |
|---|---|
| Migration `20261110000006_g1_game_catalogue.sql` | `game_user_id text null` CHECK length 4–32 |
| Column comment | “Optional title identifier… Owner-private; omitted from public projections” |
| Zod `gameUserIdSchema` | Same bounds; leading zeroes preserved as text |
| Public RPCs | Not in frozen 12-column output |
| Owner `getOwnGameProfiles` | Returns `game_user_id` to the session owner only |

**Conclusion:** Semantically and securely represents the private BGMI Player ID. **Reuse — do not duplicate.**

## Storage design chosen

- Table: `player_game_profiles`
- Column: `game_user_id`
- Scope: per `(player_user_id, game_key)` — BGMI uses `game_key = 'bgmi'`
- Sensitivity: confidential / owner-private
- Clear: set to SQL `NULL` (permitted)

## Not created

- No second BGMI ID column  
- No verification case table (M2B.3+)  
- No migration for this milestone  
