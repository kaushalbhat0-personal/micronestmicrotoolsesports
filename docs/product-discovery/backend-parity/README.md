# Backend Parity Audit — README

**Authorization:** D-14 approved read-only inspection (decision-register D-14). No database, auth, storage, migration, or credential changes authorized or performed.
**Method:** Supabase MCP read-only tools only (`list_projects`, `list_tables`, `list_migrations`, `list_extensions`, `list_edge_functions`, `get_advisors` security/performance, `execute_sql` with catalog/metadata SELECTs). No `apply_migration`, no key retrieval, no record-content SELECTs, no function invocation.
**Live target:** project `micronestmicrotoolsesports`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, Postgres 17 (repo local config targets PG15 — noted in `migration-parity.md`). Identity confirmed by name match plus prior repo references to the same project URL. The sibling project `whitelabel-lms` was not touched.
**Verdict preview:** PASS WITH EXCEPTIONS — schema matches repo design; migration *history* does not (11/58 recorded applied). Details per file.

## Files

- `live-schema-inventory.md` — tables, columns, constraints, indexes, functions, triggers, views (metadata only).
- `migration-parity.md` — 11/58 history vs full schema; drift analysis; duplicate-version note.
- `backend-reuse-matrix.md` — 16-domain reuse classification against approved discovery.
- `rls-security-audit.md` — policy inventory, advisor findings, gaps for the new domain.
- `storage-auth-audit.md` — buckets, storage policies, auth metadata posture.
- `new-platform-backend-recommendation.md` — new tables required + implementation sequence.
- `open-technical-gaps.md` — unknowns needing further validation.

**Facts vs assumptions:** anything labelled live was MCP-confirmed. Seed-row counts are tool-reported scale metadata (no record content read). Anything inferred from repo files is marked as such.
