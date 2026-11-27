# 04 — Security & RLS Verification

## Preserved

| Boundary | Status |
|---|---|
| Owner-scoped mutations via session | Yes |
| No client-supplied ownership user id | Yes |
| Anon base-table profile reads | Still denied; public via RPCs only |
| Frozen 12-field projection | Unchanged key set |
| `game_user_id` not collected / not public | Yes (deferred M2B.2) |
| Team member_count-only public projection | Untouched |
| Share Kit forbidden private keys | Untouched |
| Service role not in browser | Yes |
| Discord / verification review | Not added |

## Added controls

| Control | Layer |
|---|---|
| Completeness required to enable discoverability | UI + `set_player_discoverability` (migration) |
| Incomplete consented profiles hidden from directory | Public RPCs (migration) |
| Consent preference not auto-cleared | Schema behavior by design |

## Migration apply note

Hard DB gates are **live** on Esports `knniommcyyhbyiwljisk` after `supabase db push --linked` applied `20261128000001_p15_m2b1_discoverability_completeness.sql`. LMS project was not targeted.
