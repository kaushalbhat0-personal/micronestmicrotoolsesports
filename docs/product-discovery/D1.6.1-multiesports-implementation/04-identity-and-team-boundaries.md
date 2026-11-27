# 04 — Identity & Team Boundaries (seven layers)

1. **Platform identity:** `auth.users.id → app_users.id`, lazy idempotent
   bootstrap, owner-immutable account row (frozen D-G1-01/D-G1-02). No game
   concept at this layer — by construction a user is never "a BGMI user".
2. **Game catalogue:** `games` rows; writes migration/service-role only.
3. **Player/game profiles:** one row per (player, game); owner-private fields
   (`game_user_id`) never projected (D-G1-04). A player may hold N profiles.
4. **Team identity:** slug + name + levels + flags; game-agnostic except FK.
5. **Team/game association:** exactly one FK per team row; game fixed at
   creation (proposal, D1-D2 unapproved). Multi-game is never inferred from
   multi-title support.
6. **Game-specific vocabulary:** roles/regions/modes selected by `game_key`;
   unknown games rejected at the dispatcher so BGMI sets never leak.
7. **Organization identity:** inert reference only. Cross-game team management
   is architecturally possible (teams across games linkable to one future org)
   but conferred authority is zero until the separately approved model lands.

Adding a title touches layers 2, 3 (vocabularies), 6, and (per D1-D2) new rows
in 4/5 — never layer 1.
