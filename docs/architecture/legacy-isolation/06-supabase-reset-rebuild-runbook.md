# 06 — Supabase Reset and Rebuild Runbook (P14-C1)

Status: **Plan only — NOT executed.** No `db reset/push/repair`, no DDL/DML, no storage deletion
performed in this phase. Commands below are for a **future separately authorized** operation.
Never target `whitelabel-lms` (`iwgefthgciddukqabkun`).

## 1. Exact primary project identity (verified 2026-11-12 via MCP)

- Ref: `knniommcyyhbyiwljisk`
- Name: `micronestmicrotoolsesports`
- Org: `ocibmbassdueawosaagi` / slug `ocibmbassdueawosaagi`
- Region: `ap-northeast-1`
- Status: `ACTIVE_HEALTHY`
- PG: `17.6.1.171` (`postgres_engine 17`)
- Linked locally: `supabase/.temp/project-ref` + `linked-project.json` both → `knniommcyyhbyiwljisk` ✓
- Sibling forbidden: `whitelabel-lms` (`iwgefthgciddukqabkun`) — never list/query/touch.

## 2. Preflight checklist (read-only, all done except owner sign-off)

- [x] Confirm ref above (`get_project`).
- [x] Health `ACTIVE_HEALTHY`, PG17 (`get_project`).
- [x] Ledger: 9 applied (`list_migrations`) — names match 9 G1 files, stamps differ (dashboard-applied).
- [x] Schema: 4 tables, 7 funcs, 12 policies, 3 buckets, 8 storage policies, 0 views/crons (SELECT-only).
- [x] Row counts: `app_users 0`, `player_profiles 0`, `games 1 (bgmi)`, `player_game_profiles 0`,
  `auth.users 0`, `storage.objects 0 buckets` (SELECT-only).
- [x] Advisors: security (2 anon-DEFINER intentional + 4 auth-DEFINER expected), performance
  (`auth_rls_initplan` 10 → fix with `(select auth.uid())` in clean chain; unused-index INFO at 0 rows).
- [x] CLI link: `project-ref` matches; `config.toml project_id="micronest-esports"` (local alias, link by ref).
- [x] Local order: 20 files sort correctly; clean 7-file plan in `05` avoids stamp drift.
- [ ] Owner written approval (BLOCKING — do not proceed without it).
- [ ] Confirm no launch users arrived since audit (re-run §5 counts immediately before reset).

## 3. Destruction inventory (what reset WOULD destroy)

- Schema `public`: 4 tables + data (`games bgmi` re-seeded by clean chain), 7 functions,
  12 policies, 10 indexes, 3 triggers, grants.
- `storage.buckets` rows for 3 buckets + 8 storage policies (behavior: **reset does NOT reliably
  delete objects** — but objects are already 0; buckets must be re-created by migration `02`).
- Ledger: 9 applied entries (fresh ledger after reset).
- NOT destroyed: `auth.users` (0 rows; auth schema untouched by `db reset` semantics — re-verify),
  project itself, org, API keys, edge config. Confirm with current Supabase docs before run
  (`search_docs` + `supabase --help`) as APIs evolve.
- Deferred local-only objects are NOT on remote, so nothing deferred is destroyed.

## 4. Backup / recovery limitations

- No launch business data exists (0 users/objects) — no backup required beyond migration files in git.
- Supabase point-in-time recovery / daily backups are plan-limited and do NOT cover a deliberate reset;
  do not rely on them as undo. The undo for a bad rebuild is “re-apply correct chain,” not restore.
- Storage: verify bucket-empty (done: 0 objects across all buckets) — if non-zero at execution time,
  export object list (`SELECT bucket_id,name FROM storage.objects`) and owner-decide before reset.
- Secrets: never print keys; use linked CLI session (`supabase link`) rather than pasting service_role.

## 5. Non-Docker constraint

Local `supabase db reset/start` requires Docker — **unavailable/forbidden** in this environment.
Supported non-Docker workflow: validate ordering statically + `supabase db lint` (if available without Docker)
+ apply via linked remote (`supabase db push`) or dashboard SQL in transaction, one migration at a time,
in `05 §2` order. Document the CLI’s Docker error if encountered rather than working around it.

## 6. Reset and rebuild commands (FUTURE AUTHORIZATION ONLY — do not run now)

```bash
# 0. Re-confirm target (must print knniommcyyhbyiwljisk; abort on any other ref)
supabase link --project-ref knniommcyyhbyiwljisk
cat supabase/.temp/project-ref
supabase migration list   # expect 9 applied; confirm zero new since audit

# 1. Re-verify emptiness (read-only SQL via MCP or psql, no writes)
# SELECT counts from public.app_users/player_profiles/games/player_game_profiles,
# auth.users, storage.objects grouped by bucket_id — all must be 0 except games=1.

# 2. Reset (DESTRUCTIVE — requires owner approval recorded in P12 owner-approval-record style)
# Preferred non-Docker: dashboard → Database → Reset (if offered) OR linked push of clean chain.
# CLI equivalent (requires Docker locally; otherwise run from CI with Docker):
supabase db reset --linked
# If reset is unavailable, alternative: manually DROP clean-chain objects in reverse order
# inside a transaction per migration file — only with owner DBA oversight.

# 3. Apply clean chain in order (05 §2: 01_foundation → 07_settings)
supabase db push --linked
# Or: supabase migration up --linked (per CLI 2.109 help). One file at a time if push batches fail.

# 4. Seed check (idempotent; no manual INSERT beyond bgmi which migration 05 handles)
# SELECT key,name,is_active FROM public.games; -- expect 1 row bgmi active
```

Never run `supabase db push --include-all`, `repair`, or `COPY ... FROM` server-file commands.
Never pass `--project-ref iwgefthgciddukqabkun`.

## 7. Post-rebuild verification (read-only + app smoke)

1. `list_tables verbose` → 4 tables, RLS on, row counts 0/0/1/0.
2. `execute_sql SELECT` → `pg_policies` 12 + storage 8; `role_table_grants` default-deny shape;
   `proname` 7 funcs; `pg_indexes` 10; `storage.buckets` 3.
3. `get_advisors security/performance` → only intentional anon-DEFINER + zero `auth_rls_initplan`
   (after `(select auth.uid())` fix).
4. `generate_typescript_types` → regenerate `src/types/database.ts`; `npm run typecheck` pass.
5. `npm test` (1012 unit) + `npm run build` pass; `/api/health` 200; `/players` 200 empty (not crash);
   anon `search_player_directory(limit 1)` → `[]` no leak; authed settings flow requires session.
6. Record evidence in `docs/product-development/P13-implementation/` style final-evidence report.

## 8. Confirmation

This phase performed **zero** mutations: no reset, no push, no repair, no DDL/DML,
no storage deletion, no sibling-project access, no secret exposure. See `08` for proof.
