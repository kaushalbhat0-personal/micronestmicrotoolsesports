# 03 — Migration Cutover Preflight (P14-D2)

**Remote ledger:** not mutated. **Migrations:** not applied.  
**Live Supabase MCP list:** blocked this session (see `01-mcp-validation.md`); remote facts below from P13-C0 docs unless re-confirmed after MCP reload.

---

## 1. Active local chain — classification (post-A6 archival)

### Still in `supabase/migrations/` (17 files)

| File | Category | Docs remote status (`knniommcyyhbyiwljisk`) |
| --- | --- | --- |
| `20261110000001_foundation_baseline.sql` | Foundation | Ledger **applied** |
| `20261110000002_storage_foundation.sql` | Foundation | Ledger **applied** |
| `20261110000003`–`000007` G1… | G1 | Schema present; ledger stamps mismatched (P13 repair pending) |
| `20261111000008`–`000009` G1… | G1 | Same |
| `20261112000001_d1_admin_foundation.sql` | D1 admin | **Unapplied** — **retained** (not Teams) |
| `20261112000005_p9_organizer_foundation.sql` | P9 | Unapplied |
| `20261112000006_p9_tournament_link.sql` | P9 | Unapplied |
| `20261113000001`–`000003` P11… | P11 | Unapplied |
| `20261113000004`–`00005` P13… | P13 | Unapplied |

### Archived out of active chain (A6)

| Former path | Archive path | SHA-256 |
| --- | --- | --- |
| `supabase/migrations/20261112000002_d1_teams_discovery.sql` | `docs/.../archived-migrations/d1-teams/` | `2f4e0ac6…e79d` |
| `supabase/migrations/20261112000003_d1_security_remediation.sql` | same | `5209c028…41d8` |
| `supabase/migrations/20261112000004_d1_insert_boundary_indexes.sql` | same | `554ed952…34c7` |

Hashes match P13-C0 push manifest §3 exactly.

---

## 2. Exact archival mapping

```
ACTIVE (apply candidates)          ARCHIVED (reference only)
─────────────────────────          ─────────────────────────
…G1 01–09                          (unchanged)
D1 01 admin  ───────────────────►  retained in ACTIVE
D1 02 teams  ───────────────────►  archived-migrations/d1-teams/
D1 03 remed  ───────────────────►  archived-migrations/d1-teams/
D1 04 indexes ──────────────────►  archived-migrations/d1-teams/
P9 05–06                           (unchanged, still unapplied)
P11 01–03                          (unchanged, still unapplied)
P13 04–05                          (unchanged, still unapplied)
                                   + FUTURE P14 Teams migrations (not authored yet)
```

---

## 3. Side effects / blockers for non-Teams push

| Issue | Detail |
| --- | --- |
| P13-C0 11-file push obsolete | Manifest included D1 02–04; must be rewritten before any `db push` |
| F-A01 removed with D1 03 | `is_super_admin` active-join remediation is no longer in the active chain; re-home before relying on fail-closed admin for P11 |
| Timestamp gaps | Harmless; Supabase orders by version id |
| Remote | Still has no teams tables (per P13 docs) |

---

## 4. Planned P14 Teams migration order (author in P14-D3 — not this phase)

Suggested timestamps **after** G1 and **before or interleaved carefully with** retained D1 admin / P9 — owner sequencing required. Recommended standalone block after G1 repair, independent of P9:

1. `…_p14_teams_foundation.sql` — `teams` + immutable trigger + RLS/grants  
2. `…_p14_team_members.sql` — `team_members` + helpers + RLS deny DML  
3. `…_p14_team_audit_events.sql` — append-only audit  
4. `…_p14_team_public_rpcs.sql` — `search_teams`, `get_team_by_slug`  
5. `…_p14_team_mutation_rpcs.sql` — `create_team`, `update_team_settings`

Do **not** resurrect archived D1 teams SQL.

---

## 5. Remote comparison checklist (after Supabase MCP reload)

1. `list_migrations` / equivalent — confirm no teams objects.  
2. Confirm project ref `knniommcyyhbyiwljisk` only.  
3. Confirm read_only MCP mode.  
4. Do not repair/push in D2.
