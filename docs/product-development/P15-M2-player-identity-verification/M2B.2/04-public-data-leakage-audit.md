# 04 — Public Data Leakage Audit

Inspected surfaces for `game_user_id` / BGMI Player ID exposure.

| Surface | Result |
|---|---|
| `PUBLIC_PROJECTION_COLUMNS` (12 fields) | **Absent** |
| `search_player_directory` / `get_player_by_handle` | **Absent** (SQL select list) |
| `/players` directory UI | Uses public cards only |
| `/players/[handle]` | Public card + Share Kit allowlist |
| Player share model | Forbids `game_user_id` |
| Team public RPCs | `member_count` only; no member IDs |
| Team share model | Forbids roster/members keys |
| Marketing/route leak tests | Assert no `game_user_id` in player route sources |
| Settings owner UI | **Allowed** (owner session only) |

No widening of the frozen G1 projection in this milestone.
