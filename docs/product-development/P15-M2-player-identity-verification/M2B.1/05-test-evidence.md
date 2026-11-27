# 05 — Test Evidence

All commands actually run in this milestone.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` (unit, 1053 tests / 111 files) | PASS |
| `npm run build` | PASS |
| Focused: `consent-completeness`, `completeness`, `onboarding-status`, `player-card-model` | PASS |

## Coverage added / updated

- `src/features/player-profile/tests/consent-completeness.test.ts` — incomplete RPC mapping, D-G1-08 rule, projection freeze  
- `src/features/player-profile/domain/onboarding-status.test.ts` — soft discoverability gate for incomplete  

## Hosted DB verification (after token refresh)

| Check | Result |
|---|---|
| Target project | `knniommcyyhbyiwljisk` only (linked; LMS not listed) |
| `supabase db push --linked` | Applied `20261128000001_p15_m2b1_discoverability_completeness.sql` |
| `migration list` | Local/remote include `20261128000001` |
| Functions present | `player_profile_is_complete`, updated `set_player_discoverability`, `get_player_by_handle`, `search_player_directory` |

## Not run here

| Item | Reason |
|---|---|
| `npm run test:integration` | Opt-in embedded-postgres lane; not required for this apply |
| Playwright settings edit flow | No new e2e authored this milestone |

## Live gate expectations (now active)

- Incomplete + `is_discoverable=true` → directory/handle RPC empty  
- Complete + consent → visible (with game visibility)  
- Direct `set_player_discoverability(true)` while incomplete → error  
- Projection still exactly 12 columns  
