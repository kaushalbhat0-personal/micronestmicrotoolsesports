# 06 — Authenticated Runtime Test Results (P14-D4B)

## Capability assessment

| Requirement | Available? |
| --- | --- |
| Isolated test JWT / disposable auth users | **No** (`auth.users=0`; no test harness) |
| Docker local Supabase | **Forbidden / unavailable** |
| Second Supabase project | **Forbidden** |
| Safe mutation against primary with fabricated users | **Not authorized** (would create real auth rows) |

## Executed (safe, elevated / empty)

| Check | Result |
| --- | --- |
| `search_teams(...)` empty directory | Empty set (0 teams) |
| `get_team_by_slug('nonexistent…')` | Empty (404-equivalent) |
| Catalog ACL / RLS / function defs | See `05-…` |

## Pending matrix (not executed)

- Owner / captain / co-captain permission boundaries via PostgREST JWT
- Verified vs unverified email on `create_team`
- Active vs suspended account gates
- Private-team non-disclosure under anon JWT
- Cross-team isolation
- Direct table write denial under authenticated JWT
- Audit event creation under real session
- Cleanup of self-created test rows only

**Status: PENDING** — do not claim RLS runtime proof from elevated SQL.
