# 01 — Authentication Configuration (read-only; G1-8A verified 2026-11-11, re-verified G1-8A.1 2026-11-11)

Method: `get_project` (identity), `list_migrations`, `list_tables`
(public + auth inventory), `execute_sql` SELECT-only (policies, functions,
grants, bodies, counts), `get_advisors` (security), Vercel `list_projects` /
`get_project` / `list_project_domains` / `list_deployments`. G1-8A.1
re-ran identity, migration-history, function-body (`email_confirmed` scan),
and Vercel-domain probes. No writes, no Auth user reads, no secrets
accessed. Branch `new-platform`, HEAD `01893ae`.

## 1. Project identity (VERIFIED)

- Ref `knniommcyyhbyiwljisk`, name `micronestmicrotoolsesports`, region
  `ap-northeast-1`, status `ACTIVE_HEALTHY`, PG `17.6.1.171`
  (`get_project`, 2026-11-11). Matches G1-1..G1-7 preflight records.
- API URL `https://knniommcyyhbyiwljisk.supabase.co` (`get_project_url`).
- Sibling `whitelabel-lms` (`iwgefthgciddukqabkun`) never accessed.
- Migration history (9 records, in order): `20261110000001`
  foundation_baseline, `20261110000002` storage_foundation,
  `20261110135602` g1_identity_anchor, `20261110135654`
  g1_identity_anchor_grant_tightening, `20261110141108` g1_player_profile,
  `20261110143759` g1_game_catalogue, `20261111072251`
  g1_public_projection, `20261111090645` g1_owner_settings_lifecycle,
  `20261111091947` g1_handle_function_ambiguity_fix.
- Migration history holds the same 9 records at G1-8A.1 re-verification
  (no new migration; D-G1-10 enforcement not yet implemented, as intended —
  G1-8B scope).
- Residue: `app_users` 0 rows, `player_profiles` 0, `player_game_profiles` 0,
  `games` 1 (`bgmi` / Battlegrounds Mobile India / active). `auth.users`,
  `auth.sessions`, `auth.refresh_tokens`, `auth.identities` all 0 rows
  (table inventory counts only; no user content read).

## 2. What the database proves about Auth posture (VERIFIED)

- `auth.uid()` is the sole identity authority: all owner policies bind
  `id/user_id/player_user_id = auth.uid()`; `ensure_app_user()`,
  `create_player_profile()`, `set_player_discoverability()`,
  `update_player_handle()` all derive identity from `auth.uid()` internally
  with no caller user-ID parameter (policy text + function signatures +
  `server/*.ts` arity verified).
- No trigger in `auth` schema was created by G1 (migration inventory is
  additive on `public` only; G1-1 report preflight confirmed no
  `auth`-schema trigger; no contrary object observed).
- No Better Auth: `package.json` has no `better-auth` dependency; auth stack
  is `@supabase/ssr 0.12.7` + `@supabase/supabase-js 2.119.0`. No
  authentication-provider migration occurred.
- Session handling in code: middleware (`src/middleware.ts` +
  `src/lib/supabase/middleware.ts`) only calls `supabase.auth.getUser()`
  and refreshes cookies — no database writes. Server components/actions use
  `createServerClient` with the anon key + cookies; browser uses
  `createBrowserClient` with the anon key. Service-role is confined to
  `src/server/supabase-admin.ts` (server-only, `typeof window` guard) and is
  not imported by route, component, or feature-server modules.

## 3. Production URL configuration (VERIFIED side: Vercel)

- Vercel project `micronestmicrotoolsesports`
  (`prj_qIXcAEb9pL2Cnf2HCJesyVndAJ4Y`), framework `nextjs`.
- Production domain (verified, sole entry, unchanged at G1-8A.1
  re-verification): `micronestmicrotoolsesports.vercel.app`.
- Latest production deployment READY (`dpl_Ex2rwpQjZgn3jg9XefiH7Rz9A9n4`,
  `main` branch). No deployment-provider change; this domain is retained.
- Note: project shows `ssoProtection: enabled (all_except_custom_domains)`.
  This is a Vercel deployment-protection setting, not a Supabase setting;
  confirm it does not gate the public production URL before onboarding.

## 4. Supabase Auth settings (UNVERIFIED — no authorized read path)

The available MCP tooling exposes no Auth-configuration read API, and the
`auth` schema inventory lists no config table (only `users`,
`refresh_tokens`, `instances`, `audit_log_entries`, `sessions`, `identities`,
MFA/SSO/OAuth/WebAuthn tables). `execute_sql` was deliberately not used
against `auth.users` content. Result:

| Setting | Status | Evidence / note |
|---|---|---|
| Email/password provider enabled | UNVERIFIED (current) | Historical only: G1-1..G1-7 live lanes signed up via `anon.auth.signUp(email, password)` on 2026-11-11. Do not treat as current state. |
| Email-confirmation requirement (`enable_confirmations` / `mailer_autoconfirm`) | UNVERIFIED | Cannot inspect via authorized tools. Local `config.toml` says `enable_confirmations = false` — local-dev only, not remote evidence. |
| `site_url` | UNVERIFIED | Cannot inspect. Required value: the production application URL `https://micronestmicrotoolsesports.vercel.app`. Verify in dashboard; if it shows `localhost` or another URL, that is the exact correction (see §5). |
| Redirect allowlist (`additional_redirect_urls` / URI allow list) | UNVERIFIED | Cannot inspect. Must contain the production callback URLs plus required local dev callbacks (see §5). |
| Password-recovery support + recovery redirect | UNVERIFIED | No recovery UI exists in the repo (grep: no `resetPasswordForEmail`, no recovery route). Provider-side recovery config not inspectable. |
| Signup behavior (open vs restricted, double-confirm, autoconfirm) | UNVERIFIED | No signup UI exists in the repo. |
| Email-confirmation behavior on signup/login | UNVERIFIED | No confirmation handling in code (grep `email_confirmed` = zero matches). |
| Session / refresh-token handling (JWT expiry, rotation, reuse interval) | UNVERIFIED | Code delegates to `@supabase/ssr`. Local `config.toml` (`jwt_expiry 3600`, rotation on, reuse 10s) is local-dev only. |
| Email templates / redirect variables | UNVERIFIED | Not inspectable; do not change in this phase. |
| Prod vs dev differences | UNVERIFIED | Only one remote project inspected; no second project used (per constraints). |

## 5. Required URL corrections (report only — DO NOT apply in this phase)

Verify in the Supabase dashboard (Authentication → URL Configuration):

1. `Site URL` must equal exactly `https://micronestmicrotoolsesports.vercel.app`.
   Reason: confirmation, recovery, and magic-link redirects derive from it;
   any `localhost` or stale value breaks production email flows.
2. Redirect allowlist must include, at minimum:
   - `https://micronestmicrotoolsesports.vercel.app/**` (production callbacks),
   - `http://localhost:3000/**` (local development callback).
   Reason: without both, production confirmation/recovery redirects fail or
   local development cannot complete code exchange. Do not invent additional
   domains.
3. Confirm the email-confirmation redirect lands on an existing route that
   completes code exchange and then routes to onboarding (route does not
   exist yet — G1-8B scope). Report mismatch; do not create routes here.
