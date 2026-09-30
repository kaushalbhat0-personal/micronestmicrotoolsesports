---
name: nextjs
description: "Use for App Router, Server Components, route handlers, Server Actions, typedRoutes, and caching — version-aware for Next.js 15.4.2. Verify installed version before applying."
---

# Next.js — Framework Guidance (15.4.2)

**When to use:** App Router structure, layouts/pages, route handlers (`src/app/api/`), Server Actions, `loading.tsx`/`error.tsx`, `typedRoutes`, server/client boundaries, caching.

**When not to use:** Pure UI styling or DB/RLS without routing concern.

**Source:** Adapted from PyModel React Frontend Skills — https://github.com/PyModel/react-frontend-skills (`nextjs` skill, MIT). Installed version **15.4.2** takes precedence over any 16-only APIs in upstream.

## Version Discipline

> Verify `package.json` (`next: ^15.4.2`) before applying guidance. Do not migrate to Next.js 16 APIs merely because a skill documents them.

## Rules

**Rule: Server Components by default**
Why: Less JS, secure secrets.
Good: `src/app/(dashboard)/dashboard/page.tsx` — async Server Component, calls `requireUser()` / `getUserOrganizations()`, no `"use client"`.
Bad: Adding `"use client"` to a page just to `fetch` Supabase — use `createClient` server instead `src/lib/supabase/server.ts:1`.

**Rule: Minimize client boundary**
Why: Bundle size, security.
Good: `src/components/ui/dialog.tsx:1` and `dropdown.tsx:1` are `"use client"` — need browser interaction. `src/app/layout.tsx:1` stays server.
Bad: Making `DashboardShell` client just to read `cookies()` — use `useParams()` + server-passed `organizations` prop as in `src/components/layout/dashboard-shell.tsx:1` / `src/app/(dashboard)/layout.tsx:1`.

**Rule: Routes are orchestration**
Why: See `architecture` skill.
Good: `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx:1` — `await params` → `requireOrganizationContext` → `requireEntitlement` → render.
Bad: Route file with `supabase.from(...).select("*")` + 50 lines transform — move to `server/repositories/` + `server/services/`.

**Rule: typedRoutes:true**
Why: Catch dead links.
Good: `src/config/navigation/index.ts:18` `getDashboardNav` returns `Route` (`as Route` for dynamic `/dashboard/${orgSlug}/${slug}`), `href={item.href}` typed. Fix via `next.config.ts:1`.
Bad: `href={t.href as never}` to silence — fix link.

**Rule: Server Actions & Route Handlers — secure**
Why: Auth/validation boundary.
Good: `src/app/(dashboard)/dashboard/organizations/new/page.tsx:12` Server Action `createOrgAction` → `requireUser()` → `createOrganizationForUser` (Zod) → `redirect`. Cron `src/app/api/cron/example-job/route.ts:1` checks `assertCronAuth` `src/server/cron/cron-auth.ts:1` (Bearer `CRON_SECRET`).
Bad: `POST /api/organizations` trusting `body.organizationId` without `requireOrganizationContext`.

**Rule: Caching — version-aware**
Why: Next 15 defaults differ.
Good: `src/app/(dashboard)/...` is `ƒ` dynamic (uses `cookies()`), `src/app/page.tsx` is `○` static. Do not add `fetch` with `cache: 'no-store'` without reason; rely on `cookies()`/`auth` making route dynamic.
Bad: Adding `export const dynamic = "force-dynamic"` everywhere — let framework infer.

## Checklist

- [ ] Did I keep page to ~15 lines, delegate to `lib/`/`server/`?
- [ ] `typedRoutes` link points to real file under `src/app/`?
- [ ] Server Action / route handler validates with Zod and checks auth/entitlement?
- [ ] No secret in client, no `"use client"` without browser need?

See `next.config.ts:1`, `ARCHITECTURE.md` §9/§12, and `architecture`/`security` skills (higher precedence).
