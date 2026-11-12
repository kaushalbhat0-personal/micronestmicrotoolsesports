# 06 — Privacy and Regression (P14-D7)

## Public team projection

| Check | Result |
| --- | --- |
| Directory card | Name, slug, game, region, self-reported level, recruiting, member_count — PASS |
| Detail roster | “Public roster identities are unavailable… member details visible only to team members” — PASS |
| Owner ids in public UI | Not shown — PASS |
| `search_teams` keys | id, slug, name, game_key, region_code, levels, recruiting, member_count (no owner_user_id) — PASS |

## Private privacy

| Check | Result |
| --- | --- |
| Private slug in anon search | Hidden — PASS |
| Private detail RPC | Empty — PASS |
| Unauthenticated workspace | Sign-in only — PASS |

## G1 player directory regression

| Check | Result |
| --- | --- |
| `/players` loads on preview | PASS (empty discoverable set → “No players found”) |
| Frozen 12-column projection | Unchanged in migration `search_player_directory` returns: handle, display_name, avatar_url, bio, country_code, game_key, game_name, ign, primary_role, play_modes, region_code, availability |
| Teams migrations touch G1 RPCs | No — PASS |

## Responsive / a11y (preview)

| Surface | Notes |
| --- | --- |
| Create form | Mobile header/menu; labeled fields; no horizontal overflow observed |
| Directory / detail | Readable single-column composition |
| Settings | Owner form + player read-only state |
| Keyboard | Required validation focused first invalid field |
| Success after fail | Empty submit did not claim success |

Dedicated device-emulation resize MCP unavailable this session; preview already rendered in narrow viewport.
