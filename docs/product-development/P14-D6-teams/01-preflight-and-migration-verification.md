# 01 — Preflight and Migration Verification (P14-D6)

| Check | Result |
| --- | --- |
| Project | `knniommcyyhbyiwljisk` / `micronestmicrotoolsesports` / `ap-northeast-1` / `ACTIVE_HEALTHY` |
| Ledger count | **24** (includes `20261115000001`) |
| Hardening hash | `3A7D1A555B37839449CD125EB0EE9AA2E33F65D32F6C96303729EDC7B6704F1E` |
| Mutation grants | `create_team` / `update_team_settings`: anon=false, authenticated=true |
| Helpers | `is_team_*` / `is_super_admin`: anon=false, authenticated=true |
| Public RPCs | `search_teams` / `get_team_by_slug`: anon+authenticated |
| D5 cleanup | Confirmed prior; this phase used fresh `p14d6.*` fixtures |
| Git | `new-platform` @ `376df8f`; ~1298 staged `R` preserved |
| LMS | Never accessed (`SUPABASE_PROJECT_REF` forced to Esports) |

Pre-activation switches: Teams `false`; organizer/tournament/moderation/news `false`.
