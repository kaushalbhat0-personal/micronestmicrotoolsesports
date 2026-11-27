# 02 — Owner Access & Authorization

## Mutation path

```
BgmiPlayerIdSection (owner UI)
  → updateBgmiPlayerIdAction ("use server")
  → updateGameProfile(client, gameKey, { game_user_id })
  → authenticated owner Supabase client
  → RLS: player_user_id = auth.uid()
```

Identity is taken only from `client.auth.getUser()`. No caller-supplied user id.

## Read path

- Owner settings page loads `getOwnGameProfiles` and shows `game.game_user_id` only to the signed-in owner.
- Public directory/profile readers never select or map `game_user_id`.

## Guarantees

| Requirement | Mechanism |
|---|---|
| Unauthenticated cannot mutate | `getUser()` → `UnauthenticatedError` |
| Player A cannot update B | RLS + session-bound update |
| Player A cannot read B via settings | Owner select only |
| Team owners cannot read member IDs | No team RPC exposes `game_user_id` |
| No service-role in browser | Owner cookie client only |

## Clear semantics

- Intent `clear` or empty trimmed input → `game_user_id = null`
- Completeness / discoverability unchanged (ID not part of D-G1-08)  
