---
name: supabase
description: "Use for Supabase Auth, SSR, DB, migrations, RLS, storage, CLI, and troubleshooting — verify docs, don't rely on model memory. Installed @supabase/ssr 0.6.1, supabase-js 2.48, CLI 2.109."
---

# Supabase — Official Guidance (Adapted)

**When to use:** Any change to `src/lib/supabase/`, `supabase/migrations/`, auth (`src/lib/auth/`), DB, RLS, storage, or `supabase` CLI.

**When not to use:** Pure UI text/style without Supabase.

**Source:** Adapted from Supabase Agent Skills — https://github.com/supabase/agent-skills (`supabase` skill, MIT). Installed `@supabase/ssr 0.6.1`, `@supabase/supabase-js 2.48`, CLI `2.109` take precedence. Always verify current docs (APIs evolve).

## Rules

**Rule: Verify docs, not memory**
Why: APIs change (e.g., `getUser()` vs `getSession()`, `createServerClient`).
Good: Before implementing, check `supabase.com/docs` or `npx supabase --help` for this project's versions.
Bad: Using `supabase.auth.getSession()` for auth guard — use `getUser()` `src/lib/auth/get-user.ts:9`.

**Rule: SSR split — never mix**
Why: Security + cookies.
Good:
- Browser: `src/lib/supabase/client.ts:1` `createBrowserClient(url,anonKey)` — anon only, for `"use client"` forms `src/app/(auth)/login/login-form.tsx:1`.
- Server: `src/lib/supabase/server.ts:1` `createServerClient(url,anonKey,{cookies:{getAll,setAll}})` with `cookies()` + `CookieOptions` `@supabase/ssr` — for Server Components/Route Handlers/Actions.
- Admin: `src/lib/supabase/admin.ts:1` `createClient(url,serviceRoleKey,{auth:{persistSession:false}})` — **service_role bypasses RLS**, only server (webhooks/cron). Never import in client.
- Middleware: `src/lib/supabase/middleware.ts:1` `updateSession` + root `middleware.ts:1` refresh.
Bad: `service_role` in `src/components/ui/` or `localStorage` for tokens.

**Rule: Migrations are source of truth**
Why: Reproducible.
Good: Add `supabase/migrations/YYYYMMDD_description.sql` (e.g., `20250930000001_initial_schema.sql:1`), include `enable row level security` + policies in same file. Test with `npx supabase db reset` locally (config `supabase/config.toml:1`).
Bad: `psql` direct alter without migration file.

**Rule: Types — regenerate, don't hand-edit long**
Why: Drift.
Good: `npm run db:types` (`supabase gen types typescript --project-id $SUPABASE_PROJECT_ID --schema public > src/types/database.ts:1`) after linking `npx supabase link`. Until linked, hand-written `src/types/database.ts:1` minimal is acceptable, with `as Organization` at repository boundary `src/server/repositories/organizations.ts:12`.
Bad: Editing `src/types/database.ts` manually for 50 columns — regenerate.

## Checklist

- [ ] Did I use correct client (`browser` vs `server` vs `admin`) per boundary?
- [ ] `getUser()` not `getSession()` for auth?
- [ ] Migration file + RLS in same commit, `enable row level security` set?
- [ ] No secret in client, no `NEXT_PUBLIC_` for service_role?

See `supabase/migrations/`, `src/lib/supabase/`, `ARCHITECTURE.md` §4/§7/§8.
