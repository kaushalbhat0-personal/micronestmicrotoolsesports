# G0.2 — Foundation Acceptance Audit

- Date: 2026-11-10 (UTC)
- Auditor: senior Supabase/PostgreSQL architect, application security, release engineering (read-only audit, no remote mutations)
- Scope: greenfield foundation safety, reproducibility, internal consistency; readiness for first product-domain implementation
- No Player, Team, Organization, Brand features. No new domain migrations. No schema redesign. No production changes. No push. No deploy.

## 1. Executive verdict: CONDITIONAL PASS

Remote foundation on the exact target matches the approved greenfield design on every checked axis (identity, tables/views, routines, grants, auth count, buckets, policies, objects, migration history, advisors). Application shell follows correct SSR boundaries with server-only service-role. Repository tracks only the two approved migrations; legacy archive is isolated.

Condition before first domain implementation:

1. Complete one clean isolated local PostgreSQL 17 replay of `supabase/migrations/` in an environment with a running Docker daemon (this environment cannot run it — see §6), and
2. Apply the proposed one-line `.gitignore` addition for `supabase/.temp/` (contains a pooler connection file) to eliminate secret-commit risk (see §8).

No remote remediation is required by this audit.

## 2. Exact repository and remote project identity

Repository:

- Top-level: `D:/Projects/MicroNest MicroTools - Esports`
- Branch: `new-platform` (`git rev-parse --abbrev-ref HEAD`)
- HEAD: `01893ae5b0275979649edb754e4dd9ea6cbaebb7` (`01893ae chore(supabase): establish clean backend foundation`)
- `git log --oneline -5`: `01893ae`, `b68957f`, `8692390`, `dc5aee0`, `caff7a2`
- `git status --short --branch`: `## new-platform`, `?? pnpm-workspace.yaml`, `?? supabase/.temp/`

Target (every remote inspection used explicit ref `knniommcyyhbyiwljisk`; sibling never referenced):

- `id/ref`: `knniommcyyhbyiwljisk`
- `name`: `micronestmicrotoolsesports`
- `region`: `ap-northeast-1`
- `status`: `ACTIVE_HEALTHY`
- `database.host`: `db.knniommcyyhbyiwljisk.supabase.co`
- `database.version`: `17.6.1.171`, `postgres_engine`: `17`
- Verified via MCP `list_projects`, `get_project({id})`, CLI `projects list (linked:true)`, local `supabase/.temp/project-ref` and `linked-project.json` (name/org match), `.env` URL host ref match.

Sibling (never accessed/modified; verified only by ID for safety):

- `whitelabel-lms` / `iwgefthgciddukqabkun` / `ap-southeast-1` / `ACTIVE_HEALTHY`
- No operation in this audit targeted it. No ambiguous linked operation was run without verifying target first (`migration list --linked` resolved to target; see §11).

Project-identity stop condition: NOT triggered.

## 3. Remote database inventory (explicit ref `knniommcyyhbyiwljisk`)

All via read-only `execute_sql` / `list_tables` / `list_migrations` / `list_extensions`:

- `public` tables (`information_schema.tables WHERE table_schema='public'`): `[]`
- `public` views: `[]` (legacy `finder_public_players`, `finder_public_teams` gone)
- `public` routines: `[{"routine_name":"handle_updated_at","security_type":"INVOKER","external_language":"PLPGSQL"}]` only
- `handle_updated_at` definition: `CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS ... begin new.updated_at = now(); return new; end;` — `SECURITY INVOKER`, empty `search_path`, no table access.
- `pg_namespace public.nspacl`: `{pg_database_owner=UC/...,=U/...,postgres=U/...,anon=U/...,authenticated=U/...,service_role=U/...}` — baseline `USAGE` for `anon,authenticated,service_role` present.
- `pg_proc public.proacl` for `handle_updated_at`: `{postgres=X/postgres,service_role=X/postgres}` — `EXECUTE` revoked from `public/anon/authenticated` (only `postgres` + `service_role` retain execute; triggers still fire on DML by design).
- `pg_policies WHERE schemaname='public'`: count `0` (correct: foundation has no product tables yet).
- Legacy-like tables (`sentinel/finder/bgmi/meta_parser/payout/draft/tie_breaker`): `[]`.
- `pgcrypto` extension: `[{"extname":"pgcrypto","schema":"extensions"}]` — correct schema placement, not `public`.
- Migration history (`supabase_migrations.schema_migrations`): `[{"version":"20261110000001","name":"foundation_baseline"},{"version":"20261110000002","name":"storage_foundation"}]` only.
- CLI `migration list --linked`: `local==remote` for both versions (`20261110000001`, `20261110000002`).

Comparison: matches expected foundation (minimal baseline, no product tables/views, single trigger helper, clean lineage). No old Sentinel/Finder/billing/BGMI/meta-parser objects remain.

## 4. Auth and storage verification

### Auth

- `select count(*) FROM auth.users`: `0`. No emails/IDs retrieved.
- Auth service: enabled (`supabase/config.toml [auth] enabled=true`; previous `config push` reported `auth: updated`; `get_project` remains `ACTIVE_HEALTHY`).
- Baseline evaluated from committed `supabase/config.toml` (source of truth pushed during reset; remote re-query of Auth config is not available via MCP/CLI read-only in this audit — see §12):
  - `site_url="http://localhost:3000"`, `additional_redirect_urls=["https://localhost:3000"]`
  - `enable_signup=true`, `enable_anonymous_sign_ins=false`, `enable_manual_linking=false`
  - `minimum_password_length=8`
  - `[auth.email] enable_confirmations=false`, `otp_length=6`, `otp_expiry=3600`, `max_frequency="1s"`
  - `[auth.mfa.totp] enroll_enabled=false, verify_enabled=false`; `[auth.mfa.phone]` disabled
  - No `[auth.external.*]` enabled; `oauth_server enabled=false`; all third-party providers disabled.
- See §9 for per-setting classification. No OAuth approved. No Auth disable. No user deletion performed in this audit (read-only).

### Storage

- Buckets (`storage.buckets ORDER BY id`): exactly 3 —
  - `private-verification`: `public=false`, `file_size_limit=5242880`, `allowed_mime_types=[png,jpeg,webp,pdf]`
  - `public-avatars`: `public=true`, `file_size_limit=524288`, `[png,jpeg,webp]`
  - `public-entity-media`: `public=true`, `file_size_limit=2097152`, `[png,jpeg,webp,svg+xml]`
- Matches approved design (512 KB avatars, 2 MB entity media with 1 MB logo cap enforced at app validation per migration comment, 5 MB private verification, image+PDF only, verification private).
- Objects: `select count(*) FROM storage.objects` = `0`; per-bucket grouping empty. Legacy objects gone.
- Policies (`pg_policies WHERE schemaname='storage'`, expressions inspected, not inferred from names): 8 total —
  - `public-avatars public read` (`public`, SELECT, `bucket_id='public-avatars'`)
  - `public-entity-media public read` (`public`, SELECT, `bucket_id='public-entity-media'`)
  - `public-avatars owner insert` (`authenticated`, INSERT, `bucket_id='public-avatars' AND foldername(name)[1]=auth.uid()::text`)
  - `public-avatars owner update` (USING + WITH CHECK, same owner scope)
  - `public-avatars owner delete` (USING, same owner scope)
  - `private-verification owner insert` (WITH CHECK, owner scope)
  - `private-verification owner read` (SELECT, `authenticated`, owner scope — no public read)
  - `private-verification owner delete own pending` (DELETE, owner scope)
- No blanket `storage.objects` access. No `entity-media` authenticated-insert (service_role-only by design until domain tables land). No public read on `private-verification`. Owner paths enforce `{uid}/...` via `storage.foldername(name)[1]=auth.uid()::text`.

### Advisors

- `get_advisors({type:"security"})`: `{"lints":[]}`
- `get_advisors({type:"performance"})`: `{"lints":[]}`

## 5. Migration source review

Reviewed line by line (files listed in §11).

`20261110000001_foundation_baseline.sql` (47 lines):

- `create schema if not exists extensions;` + `create extension if not exists "pgcrypto" with schema extensions;` — correct placement (not `public`), idempotent.
- `create or replace function public.handle_updated_at() ... security invoker set search_path=''` — explicit `SECURITY INVOKER` (default stated), empty search path (only `now()` resolves), trigger-only helper. Idempotent via `OR REPLACE`.
- `revoke all on function ... from public/anon/authenticated;` — least privilege on trigger helper; idempotent. Verified remotely as `proacl={postgres,service_role}` only.
- `grant usage on schema public to anon, authenticated, service_role;` — restates platform default, no table grants (per-table grants deferred to domain migrations). Idempotent.
- Scope comments explicitly exclude product/audit tables, views, buckets (buckets in 02). PG17 compatible (no deprecated syntax).

`20261110000002_storage_foundation.sql` (126 lines):

- Buckets inserted with explicit `id/name/public/file_size_limit/allowed_mime_types`, `on conflict (id) do nothing` — idempotent, replaces legacy `org-logos/finder-avatars/finder-verification` per header comment.
- Limits/MIME match §4. No executable/script types. Two-layer enforcement documented (bucket + app re-validation).
- 8 policies as verified in §4: scoped to explicit `bucket_id`, `authenticated` + owner `foldername` checks, `public` only for SELECT on the two public buckets. No permissive write to `public-entity-media` (comment explains service_role-only until domain tables).
- `create policy` has no `IF NOT EXISTS` (Postgres limitation). Safe under the supported `db reset`/`db push` once-only flow with history; manual re-run on a dirty DB would error rather than silently duplicate — acceptable, but document as Informational (see §10). No `DROP POLICY IF EXISTS` needed and none added (would hide drift).
- PG17 compatible. No destructive `DROP` in migration itself (drops only occur via `db reset` user-entity cleanup, not in migration SQL).

Discrepancy migration-vs-remote: none. Remote `handle_updated_at`, grants, buckets, policies match source exactly.

## 6. Local PostgreSQL 17 replay evidence

Requirement: isolated clean replay of `supabase/migrations/` on PostgreSQL 17 without using remote as substitute and without changing production config.

Result: NOT PERFORMED — environment blocker (reported, not claimed).

Evidence:

- `supabase --version`: `2.109.1`
- `docker --version`: `Docker version 29.9.2, build a82e528`
- `docker ps`: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.`
- `Get-Service com.docker.service`: `Status: Stopped`; `Start-Service com.docker.service`: `Cannot open com.docker.service service ... CouldNotStartService` (no elevation attempted; no prod change attempted).
- `where.exe psql` / `pg_ctl`: not found.
- Current `package.json` has no `embedded-postgres` dependency (only `ref/legacy-project/toolchain` does). No `src/server/testing/*-pg-harness.ts` in greenfield. `vitest.config.ts` has `hookTimeout:180000` but no integration harness to reuse.
- `supabase/config.toml [db] major_version=17`, `seed.sql` intentionally empty (no data to replay).

Impact: remote application is verified (`migration list --linked` in sync, history clean), but the “clean-room” guarantee (fresh `supabase start` + `db reset --local` applying only the two migrations on PG17) is not evidenced in this environment.

Next: run in an environment with Docker Desktop running: `supabase start`, `supabase db reset --local` (or `supabase db reset` default local), then re-run §3 queries against local (`supabase db query` / `psql`) and record schema/routines/buckets/policies. Do not use `--linked` for replay.

## 7. Application architecture/security review

Shell (`src/`): greenfield only, no domain features (compliant).

- Supabase browser client (`src/lib/supabase/client.ts`): `createBrowserClient(URL, ANON_KEY)` via `getPublicEnv()` — correct SSR browser pattern, anon only.
- Server client (`src/lib/supabase/server.ts`): `createServerClient(URL, ANON_KEY, {cookies getAll/setAll})` with `cookies()` from `next/headers`, try/catch around `setAll` for read-only Server Components — correct.
- Middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts:updateSession`): `createServerClient` with request cookies, `response.cookies.set`, `await supabase.auth.getUser()`, return response — correct session refresh; matcher excludes static assets.
- Service-role (`src/server/supabase-admin.ts:createAdminClient` + `src/server/env.ts`): `createServiceClient(URL, SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}})`, `if (typeof window!=="undefined") throw` — server-only guard. Grep: `SERVICE_ROLE|createAdminClient` only in `src/server/*`; no client import. `src/app` grep for `server|SERVICE_ROLE|admin` only hits `next/server` import in health route (benign). `src/components` grep: no matches (presentational).
- Env validation: `src/lib/env.ts` (public: URL+ANON via zod `url/min(1)`, cached), `src/server/env.ts` (adds `SERVICE_ROLE_KEY`, cached). No defaults that mask missing secrets; `parse` throws on absent. No secret values logged (only `process.env.*` reads inside zod parse).
- Error/404 (`src/app/error.tsx`, `not-found.tsx`): generic messages, `error.digest` reference only, no stack/secrets leaked; `not-found` static link.
- Security headers (`next.config.ts`): `X-Frame-Options:DENY`, `X-Content-Type-Options:nosniff`, `Referrer-Policy:strict-origin-when-cross-origin`, `Permissions-Policy:camera=(),microphone=(),geolocation=()` — sound baseline.
- Health (`src/app/api/health/route.ts`): static `{status:"ok",service}` — no DB/auth touch, no PII.
- Legacy isolation: `grep legacy|sentinel|finder|bgmi|meta_parser|dodo|razorpay|stripe src/` → only `src/features/README.md:8` mentions `` `ref/legacy-project/` `` as “Do not import”. `grep from ["']ref/` → same single doc hit. `tsconfig exclude: ["ref/**"]`, `eslint ignores: ["ref/**"]` — correct. No runtime import from `ref/`.
- Types: `tsconfig strict:true, exactOptionalPropertyTypes:true, noUncheckedIndexedAccess:true, noFallthroughCasesInSwitch, noImplicitOverride, forceConsistentCasingInFileNames` — strict intact. `src/types/database.ts` placeholder (`Record<string,never>`) with “Regenerate after every migration ... Do not hand-edit” — acceptable for zero-table foundation; must regenerate when domain tables land.
- Logs: `grep console.log|console.error|process.env src/` → only `process.env` reads inside `lib/env` + `server/env` (safe); `no-console` rule warns (allow warn/error). No secret logging found.

## 8. Repository hygiene findings

- `.gitignore`: ignores `.env`, `.env.local`, `.env.*.local`, `.env.production`, etc., `.supabase`, `.vercel`, `coverage`, `.DS_Store`, `tsbuildinfo`, `playwright-report`, `test-results`. Does NOT ignore `supabase/.temp/` (only `.supabase`). Evidence: `git check-ignore -v supabase/.temp` → no output; `git ls-files --others --exclude-standard` lists `supabase/.temp/cli-latest`, `gotrue-version`, `linked-project.json`, `pooler-url`, `postgres-version`, `project-ref`, `rest-version`, `storage-migration`, `storage-version`, `pgdelta/...`. Tracked `supabase/` files are only `config.toml`, 2 migrations, `seed.sql` (clean). `.env` correctly untracked+ignored (`git check-ignore -v .env` → `.gitignore:14:.env`).
  - Risk: `supabase/.temp/pooler-url` (97 chars) holds a connection string (credential material). An accidental `git add -A` would stage it. No secret is currently tracked (`git ls-files` shows no `.env`, no `.temp`).
  - Proposal (not applied; left uncommitted per constraints): append to `.gitignore`:
    ```
    # supabase local linkage / temp (contains pooler-url credentials)
    supabase/.temp/
    ```
- `.env.example`: only placeholders (`https://your-project.supabase.co`, `eyJhbGciOi...`, `http://localhost:3000`), no real secrets. Safe.
- `supabase/config.toml`: `project_id="micronest-esports"`, `major_version=17`, `schemas=["public","storage","graphql_public"]`, `seed sql_paths=["./seed.sql"]`, auth baseline as in §4, no hardcoded secrets (uses `env()` for optional provider secrets with empty defaults). Safe to commit.
- Active migrations: only 2 approved files (see §11 hashes). No legacy files in `supabase/migrations`. Legacy 58 migrations live under `ref/legacy-project/supabase/migrations/` (reference-only). CLI `[db.migrations] schema_paths=[]` + default `supabase/migrations` means legacy cannot be accidentally applied. `git log --oneline -- supabase/migrations/` shows foundation history only.
- `pnpm-workspace.yaml` (untracked): content is placeholder invalid for pnpm (`allowBuilds: '@embedded-postgres/windows-x64': set this to true or false` etc.). Project uses npm (`package-lock.json` tracked, `npm ls` consistent, scripts use `npm run`). File is not in HEAD, not imported. Recommendation: delete file OR replace with valid minimal config if pnpm is intended; do not commit placeholder. No change made in audit.
- Lockfile: `package-lock.json` tracked, `npm ls @supabase/ssr @supabase/supabase-js` → `0.12.7` / `2.119.0 deduped` — consistent. No `pnpm-lock.yaml` (expected since npm is used).
- No service-role in client bundles (see §7). No `.env` committed.

No files modified in this audit. No commits. No pushes.

## 9. Auth baseline decisions required before public onboarding

Evaluated from committed `supabase/config.toml` (pushed baseline). Each classified per request. No changes made.

| Setting | Current | Classification | Rationale / gate |
|---|---|---|---|
| `site_url=http://localhost:3000`, `additional_redirect_urls=[https://localhost:3000]` | localhost | Must be corrected before public onboarding (and before any public-auth feature) | Development baseline only. Before public signup/login, set production `site_url` + explicit allowlist, remove localhost. |
| `auth.email.enable_confirmations=false` | disabled | Requires product/security decision before public onboarding; must be corrected before public signup if email verification is required | Acceptable for local dev velocity. For public, enabling confirmations reduces fake/spam accounts; if kept disabled, document why + add anti-abuse (rate limit, captcha). |
| `minimum_password_length=8` | 8 | Acceptable for current development baseline; revisit before public onboarding | Meets minimum; consider 10–12 + `password_requirements` (currently `""`) before public launch. |
| `mfa.totp enroll/verify=false`, `mfa.phone=false` | disabled | Requires decision before relevant feature (admin/reviewer, privileged roles) | Acceptable for foundation. Enable TOTP for future admin/reviewer roles; do not block first domain read-only work on it. |
| `otp_length=6`, `otp_expiry=3600`, `email.max_frequency=1s`, `rate_limit.*` | 6 / 1h / 1s / 2 email_sent etc. | Acceptable for development; review before public | Low friction for dev. Tighten `max_frequency` + expiry before public (e.g., shorter OTP expiry, stricter email rate). |
| `enable_signup=true`, `enable_anonymous_sign_ins=false`, `enable_manual_linking=false` | signup on, anon off | Acceptable for development; signup requires decision before public | Keep `true` for dev; before public, confirm whether open signup is desired vs invite-only. |
| `jwt_expiry=3600`, refresh rotation true | 1h | Acceptable | Standard. |
| No OAuth / SSO / third-party providers enabled | all disabled | Acceptable; requires approved config before enabling any provider | Do not enable without approved client/secret + redirect allowlist. |

## 10. Findings

### Critical

None. No destructive behavior, no sibling impact, no identity mismatch, no permissive storage, no tracked secrets.

### High

- **H1 — `supabase/.temp/` not git-ignored; `pooler-url` credential file untracked but committable.** Evidence: §8 `check-ignore`/`ls-files --others`. Impact: accidental `git add -A` would commit DB connection secret. Fix (proposed, not applied): add `supabase/.temp/` to `.gitignore`. No commit made.

### Medium

None beyond H1. (Auth localhost + confirmations-off are expected dev baselines with explicit gates in §9, not defects.)

### Low

- **L1 — `pnpm-workspace.yaml` placeholder untracked with invalid `allowBuilds` values.** Project uses npm (`package-lock.json`); file is not in HEAD. Action: delete OR replace with valid pnpm config if pnpm intended. Not applied.
- **L2 — `create policy` without `IF NOT EXISTS` in storage migration.** Postgres limitation; safe under once-only `db reset`/`push` + history, but manual re-run on dirty DB errors. Informational: keep clean-DB replay workflow; do not add `DROP POLICY` guards that would hide drift.
- **L3 — `src/types/database.ts` placeholder (`Record<string,never>`)**. Correct for zero-table foundation; must regenerate (`npm run db:types`, requires local stack) when first domain tables land.

### Informational

- Next.js build warns `"middleware" file convention is deprecated. Please use "proxy" instead.` Build still succeeds (see §11). Track Next 16 migration (`npx @next/codemod@canary middleware-to-proxy`) separately; no change in audit.
- `supabase/.temp/pgdelta/pgdelta-target-ca.crt` present (local diff TLS artifact, untracked). Covered by H1 fix.
- E2E not run (needs dev server); Playwright 1.65.0 present, spec is smoke-only.

## 11. Exact evidence and commands used

Read-only unless noted (no remote writes in this audit):

- `git rev-parse --show-toplevel; git rev-parse --abbrev-ref HEAD; git rev-parse HEAD; git log --oneline -5; git status --short --branch` → §2
- `git ls-files supabase/` → `config.toml`, 2 migrations, `seed.sql` only
- `git ls-files | Select-String legacy` → only `ref/legacy-project/*` (archive, expected)
- `git ls-files --others --exclude-standard` → `pnpm-workspace.yaml`, `supabase/.temp/*` (not ignored)
- `git check-ignore -v .env supabase/.temp/project-ref pnpm-workspace.yaml` → `.env` ignored, `.temp`/workspace not
- `git hash-object supabase/migrations/*` → `870aaa...` (01), `3d1529...` (02)
- `Get-ChildItem ref/legacy-project/supabase/migrations | Measure` → `58` (isolated, not active)
- MCP (explicit `project_id="knniommcyyhbyiwljisk"`): `get_project`, `list_projects`, `list_tables(schemas:["public"],verbose:false)`, `list_migrations`, `list_extensions`, `execute_sql` for routines/search_path/grants/ACL/views/tables/auth_count/buckets/objects/policies/migration_history/pgcrypto, `get_advisors(security|performance)` → §§3–4
- CLI read-only: `supabase --version (2.109.1)`, `supabase migration list --linked` → `local==remote` both versions; `supabase projects list` → `linked:true` to target
- Docker: `docker --version (29.9.2)`, `docker ps` → daemon missing; `Get-Service com.docker.service` → `Stopped`; `Start-Service` → `CouldNotStartService`; `where.exe psql/pg_ctl` → not found → §6 blocker
- Validation: `npm run typecheck` → pass (no output); `npm run lint` → pass; `npm run test` → `1 passed (src/lib/example.test.ts)`; `npm run build` → `Compiled successfully`, static `/`, `/_not-found`, dynamic `/api/health`, `Proxy (Middleware)`; `npx playwright --version` → `1.65.0` (e2e not run — needs dev server)
- `npm ls @supabase/ssr @supabase/supabase-js` → consistent `0.12.7`/`2.119.0`
- Greps: `SERVICE_ROLE` only in `src/server/*` with window guard; `legacy|sentinel|...` only in `features/README.md` doc; `ref/legacy-project` only same doc; `console|process.env` only env parsers
- Files read: `.gitignore`, `.env.example`, `supabase/config.toml`, both migrations, `seed.sql`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `next.config.ts`, `vercel.json`, `playwright.config.ts`, `src/middleware.ts`, `src/lib/supabase/{client,server,middleware}.ts`, `src/lib/env.ts`, `src/server/{env,supabase-admin}.ts`, `src/app/{layout,page,error,not-found}`, `src/app/api/health/route.ts`, `src/config/site.ts`, `src/types/*`, `src/features/README.md`, `e2e/home.spec.ts`

No secrets, tokens, passwords, keys, URLs with credentials, or user PII are included in this report. Env inspected by name/presence only.

## 12. Explicit limitations and skipped checks

- Local clean PostgreSQL 17 replay NOT performed (blocker §6). Remote state is not used as substitute; replay must be done where Docker runs.
- Remote Auth config not re-fetched via Management API (no read-only MCP/CLI inspector available; `config pull` would dirty the working tree). Baseline judged from committed `config.toml` (the pushed source of truth). No Auth change made.
- E2E (Playwright) not executed (requires `npm run dev` server + browser; smoke spec only). Unit lane only (`1 test`).
- Integration lane (`*.integration.test.ts`) absent in greenfield (no harness, no `embedded-postgres` dep) — nothing to run.
- Sibling `whitelabel-lms` deliberately not inspected beyond ID/status for safety; no tables/buckets queried there.
- No `supabase start/stop/reset/push`, no Auth/Storage writes, no Git push/commit in this audit.

## 13. Recommended next gate

1. In a Docker-capable environment: `supabase start` → `supabase db reset --local` (clean) → re-run §3–§4 queries locally → record evidence → `supabase stop`. Then proceed.
2. Apply H1 `.gitignore` fix (uncommitted patch for review):
   ```diff
   +# supabase local linkage / temp (contains pooler-url credentials)
   +supabase/.temp/
   ```
   Plus decide L1 (`pnpm-workspace.yaml` delete vs valid pnpm config).
3. Then open first domain implementation (no Player/Team/Org/Brand in this audit). First migration must include per-table GRANTs/RLS (foundation deliberately grants only schema USAGE), regenerate `src/types/database.ts`, and add unit + (where Docker available) embedded-postgres integration tests per `docs/product-discovery/backend-foundation/testing-strategy.md`.
4. Before public onboarding: resolve §9 gates (production `site_url`/allowlist, email-confirmation decision, password/MFA/OTP hardening, signup mode).

---

## Closure Addendum — G0.2 Supabase-Native Verification (2026-11-10)

No Docker used. No Docker start attempted. No local PostgreSQL required. No primary reset/push/modification. Sibling never accessed beyond project-list metadata. No commits, no pushes, no product features. `.gitignore` hygiene edit left unstaged; report update is the only file content change in this closure.

### 1. H1 remediation

- Inspected `.gitignore` (22-line supabase section only had `.supabase`).
- Applied narrowly scoped fix (unstaged, not committed):
  ```diff
   # supabase
   .supabase
  +supabase/.temp/
  ```
- Verified: `git check-ignore -v supabase/.temp/pooler-url supabase/.temp/project-ref supabase/.temp/linked-project.json` → all ` .gitignore:24:supabase/.temp/`; `git status` no longer lists `supabase/.temp/` as untracked.
- `.env` remains ignored (`.gitignore:14:.env`); `.env.local` ignored.
- `.env.example` contains placeholders only (`https://your-project.supabase.co`, `eyJhbGciOi...`, `http://localhost:3000`, server key placeholder). No real secrets.
- Tracked/staged secret scan: `git ls-files | Select-String '\.env$|pooler-url|service_role|secret'` → only two legacy archive migration filenames containing `service_role_grant` under `ref/legacy-project/` (reference-only, no secret values). `git diff --cached --name-only` → empty. No `.env` or `pooler-url` tracked or staged.
- `pnpm-workspace.yaml` (untracked placeholder, `allowBuilds: ...: set this to true or false` strings): demonstrably unnecessary — no `pnpm-lock.yaml` (only `package-lock.json`), no `packageManager` field in `package.json`, README uses `npm run` exclusively. Removed untracked file per Phase A authorization. `git status` confirms gone. No pnpm functionality depended on it.

### 2. Supabase-native testing environment

MCP capabilities inspected (via `search`, no assumption):
- Identity: `list_projects`, `get_project` — verified working.
- Migration history: `list_migrations` — verified working.
- Read-only SQL inspection: `execute_sql` — verified working (SELECT only in this closure).
- Schema inventory: `list_tables`, `list_extensions` — verified working.
- Storage metadata: via `execute_sql` on `storage.buckets` / `storage.objects` / `pg_policies WHERE schemaname='storage'` — verified working (no dedicated storage MCP tool assumed).
- DDL application: `apply_migration` exists but NOT used (would write to target; prohibited on primary, no authorized isolated target).
- No MCP Auth-admin, Auth-config, or bucket create/delete tools assumed or used.

CLI capabilities inspected:
- `projects list`, `migration list --linked` — verified working read-only.
- `db push --linked`, `db reset --linked`, `config push`, `storage rm`, `branches create` — exist but NOT used (all would write or risk primary scope; explicitly prohibited).

Isolated test project discovery:
- `list_projects` returns exactly 2 projects: primary `knniommcyyhbyiwljisk` (`micronestmicrotoolsesports`, `ap-northeast-1`) and sibling `iwgefthgciddukqabkun` (`whitelabel-lms`, `ap-southeast-1`). No third/disposable test project exists. `list_organizations` → single org `ocibmbassdueawosaagi`.
- No preview-branch reliance: branches are not projects and creation incurs billing/scope on the primary org; not created without explicit authorization.

Conclusion: no verified disposable test project exists. Per Phase B rules, primary was not reset/repurposed and no project/branch was created. A disposable PG17 test project (explicitly authorized) is required for fresh replay.

### 3. Exact isolated test project identity, if used

None used. No isolated project exists; no replay target authorized. Sibling identity listed in §2 solely to prove it is not the target; no sibling tables/buckets/SQL touched.

### 4. Migration replay evidence

Fresh replay NOT performed — blocked by missing authorized disposable target (see §2). No `apply_migration`, no `db push`, no arbitrary SQL to simulate history, no Docker, no local PG.

Active migration directory confirmed clean (re-inspected, not modified):
- `supabase/migrations/` contains only `20261110000001_foundation_baseline.sql` and `20261110000002_storage_foundation.sql`.
- Legacy 58 migrations remain isolated under `ref/legacy-project/supabase/migrations/`; CLI `[db.migrations] schema_paths=[]` means they cannot be accidentally applied.
- `supabase/seed.sql` intentionally empty (3-line header only).

Primary history match (`migration list --linked` → `local==remote` both versions) is recorded as deployment consistency only — NOT claimed as fresh replay per Phase F verdict rules.

### 5. PostgreSQL version evidence

- Primary: `get_project` → `database.version=17.6.1.171`, `postgres_engine=17` (explicit ref). `supabase/config.toml [db] major_version=17`.
- Replay-target PG evidence: N/A (no replay; no target). Migration source is PG17-compatible (standard DDL, `pgcrypto with schema extensions`, `security invoker`, `search_path=''`, no deprecated syntax).

### 6. Resulting schema and storage verification (replay target)

N/A — no replay executed. Expected-result checklist from Phase C is retained as acceptance criteria for when an authorized disposable project exists (0 domain tables/views, `handle_updated_at` only routine, `pgcrypto` in `extensions`, grants/ACL match, 3 buckets, 8 policies, correct public/private, no legacy, history exactly 2 versions). Primary read-only state in §7 already matches this shape but is not substituted for replay.

### 7. Primary project read-only verification (explicit ref `knniommcyyhbyiwljisk`, no writes)

- Identity/status: `micronestmicrotoolsesports`, `ap-northeast-1`, `ACTIVE_HEALTHY`, PG `17.6.1.171`/`17`.
- Migration history: `list_migrations` + `supabase_migrations.schema_migrations` → exactly `20261110000001 foundation_baseline`, `20261110000002 storage_foundation`. CLI `migration list --linked` → `local==remote` both.
- Public inventory: `list_tables(public)` → `[]`; `information_schema.views WHERE table_schema='public'` → `[]`; routines → `handle_updated_at INVOKER` only; `pg_policies WHERE schemaname='public'` count `0`; legacy-like tables `[]`.
- Storage: buckets exactly `private-verification (private, 5242880, png/jpeg/webp/pdf)`, `public-avatars (public, 524288, png/jpeg/webp)`, `public-entity-media (public, 2097152, png/jpeg/webp/svg+xml)`; objects `0`; `pg_policies WHERE schemaname='storage'` → 8 policies (`2× public read`, `3× avatar owner`, `3× verification owner`, no entity-media authenticated insert).
- Auth users: `select count(*) FROM auth.users` → `0` (no PII retrieved).
- Advisors: `security lints:[]`, `performance lints:[]`.
- No primary write performed (no reset/push/config/storage/auth/schema changes).

### 8. Regression checks

- `npm run typecheck` (`tsc --noEmit`) → pass.
- `npm run lint` (`eslint .`) → pass.
- `npm run test` (`vitest run --exclude **/*.integration.test.ts`) → `1 passed (src/lib/example.test.ts)`, `Duration ~3.5s`.
- `npm run build` (`next build`) → `Compiled successfully`, TypeScript pass, static `/`, `/_not-found`, dynamic `/api/health`, `Proxy (Middleware)`; only known warnings (middleware→proxy deprecation, slow-filesystem notice).
- Playwright: `npx playwright test --list` → `1 test (home.spec.ts)`; full `npx playwright test` attempted (dev-server path, no Docker) → environment failure, not code failure: `browserType.launch: Executable doesn't exist ... ms-playwright/chromium_headless_shell ... Please run npx playwright install`. Reported as skipped (browsers not installed; install not performed in audit).
- Git hygiene: `git status --short --branch` → `## new-platform`, ` M .gitignore` (H1 fix, unstaged), ` M next-env.d.ts` (generated side effect: import path `.next/types/` → `.next/dev/types/` from build/dev run, benign), `?? AGENTS.md` (auto-generated by `next dev` via Playwright webServer per embedded `generate-agent-files.js` notice, untracked), `?? docs/audits/` (this report, untracked). `git diff --cached --name-only` → empty. No commits, no pushes.
- No domain implementation, no migration edits, no schema redesign.

### 9. Remaining blockers

1. Disposable Supabase test project (PG17, explicitly authorized, verified not primary/sibling, confirmed disposable) required to perform Phase C fresh replay. No such project exists in the org.
2. Unstaged working-tree items intentionally left for owner review (not committed per constraints): `.gitignore` H1 fix, generated `next-env.d.ts` path flip, auto-generated `AGENTS.md`, `docs/audits/` report.
3. Playwright browsers uninstalled (e2e skipped for environment, not code).

### 10. Final verdict: CONDITIONAL PASS

Per verdict rules: H1 fixed (verified ignored, unstaged) but no authorized isolated project exists for replay → CONDITIONAL PASS (not PASS, not FAIL).

No security regression, no destructive change, no incorrect migration result. Primary remains `ACTIVE_HEALTHY` with clean foundation. First domain implementation must wait for either (a) authorized disposable-project replay evidencing §6 criteria, or (b) explicit risk acceptance documenting why replay is deferred.

---

_Closure completed Supabase-natively without Docker. Primary inspection-only. No Git commit or push performed. Working tree changes left unstaged for owner review: `.gitignore` (H1), generated `next-env.d.ts`, auto-generated `AGENTS.md`, `docs/audits/`._
