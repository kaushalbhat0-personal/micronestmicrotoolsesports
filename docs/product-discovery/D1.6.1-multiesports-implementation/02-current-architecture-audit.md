# 02 — Current Architecture Audit (implementation vs approved principle)

Verdict: the tree already satisfies the principle. Evidence, not new
abstraction, is the implementation (plus contract tests).

| Principle element | Implementation | Evidence |
|---|---|---|
| Platform identity separate | `app_users.id = auth.users.id`; canonical profile keyed by `user_id` 1:1; no game in canonical identity | `20261110000003`, `20261110000005` |
| Game catalogue | `games(key,name,short_name,is_active)`; BGMI seed only | `20261110000006:48-67` |
| Player/game profiles | `player_game_profiles` `UNIQUE(player,game)` — one profile per player per game (multi-profile supported, none duplicated) | `20261110000006:70-95` |
| Team identity | `teams` row + slug; no identity dependence on game beyond FK | `20261112000002:11-27` |
| Team/game association | `teams.game_key → games RESTRICT`; one game per team row (proposed; D1-D2 unapproved — NOT claimed as approved) | `20261112000002:13` |
| Game-specific vocabulary | BGMI roles/regions/modes in code + CHECKs; per-game region dispatcher rejects unknown games; `ONLINE` game-only | `schemas/game.ts:14-77`, `20261110000006:78-90` |
| Org identity / cross-game | `organization_id TEXT NULL`, inert, in no RLS (future cross-game management possible, authority undesigned) | `20261112000002:23` |

No second identity system. No per-game account duplication (bootstrap is
`INSERT … ON CONFLICT DO NOTHING` on the single anchor). No multi-game team
introduced (one-game-per-row is the unapproved proposal, still requiring D1-D2).
Catalogue interface accommodates future titles through the supported/planned/
unknown tri-state (`catalog.ts`) without activating them.
