# 02 — Completeness & Discoverability

## Discrepancy vs M2A architecture proposal

M2A proposed a stricter “directory-eligible” set (role/region/modes/`game_user_id`).  
**M2B.1 owner instructions:** do not invent new mandatory fields; BGMI ID is M2B.2.

**Resolution:** enforce existing **D-G1-08** only — documented in architecture open decision D1 as the safer compatible approach for this milestone.

## Canonical rule

Shared by onboarding status, settings UI, soft access-policy, and SQL:

1. handle present  
2. display_name non-empty  
3. avatar_path **or** non-empty bio  
4. ≥1 `player_game_profiles` row  

TypeScript: `src/features/player-profile/server/completeness.ts`  
SQL: `public.player_profile_is_complete(uuid)` in migration `20261128000001_…`

## Concepts (kept separate)

| Concept | Storage / signal |
|---|---|
| Profile complete | Derived |
| Discoverability consent | `player_profiles.is_discoverable` |
| Effective public visibility | consent ∧ complete ∧ game `is_visible` ∧ active account ∧ active game |
| Verification badge | Not in this milestone |

## Consent transitions

| Action | Behavior |
|---|---|
| Enable while complete | Allowed (UI + RPC) |
| Enable while incomplete | Rejected (`ProfileIncompleteError` / SQL `profile incomplete`) |
| Disable anytime | Allowed |
| Become incomplete after opt-in | Consent flag **preserved**; public RPCs hide the player (after migration) |
| Become complete again with consent still on | Reappears without new opt-in |
| Previously opted out | Stays out until explicit enable |

## Migration objects

- `player_profile_is_complete(uuid)`
- `set_player_discoverability` completeness gate on `true`
- `search_player_directory` / `get_player_by_handle` add completeness predicate  
- **12 return columns unchanged**
