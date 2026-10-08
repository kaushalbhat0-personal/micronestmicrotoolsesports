# MicroNest — Architecture Foundation (RCCF-FOUNDATION-02)

> Update: Canonical organization context established via URL slug. See §6.

> For junior developers: this document tells you **where everything belongs** and **why**.

> For junior developers: this document tells you **where everything belongs** and **why**.

---

## 1. Overall Architecture

MicroNest is a **multi-tenant micro-SaaS platform**. One deployment hosts many independent microtools (Sponsor Sentinel, Scrim Matchmaker, etc.). Each microtool is an isolated feature domain — adding a new tool should not require restructuring the app.

Principles:
- **SOLID, DRY, KISS, Separation of Concerns**
- **Server Components by default** — `"use client"` only for interaction/browser APIs
- **Orchestration only in pages/routes** — business logic, DB access, validation live elsewhere
- **Tenant isolation at DB level (RLS)** — not just frontend filtering
- **Design-system-first UI** — primitives → shared → feature → pages
- Strict TypeScript, explicit contracts, secure-by-default

---

## 2. Folder Structure

```
src/
├── app/                     # Next.js App Router — typedRoutes:true
│   ├── (marketing)/         # Optional route group — public pages
│   ├── (auth)/              # login, signup, auth callback
│   ├── (dashboard)/         # protected area — requires auth
│   │   ├── dashboard/
│   │   │   ├── page.tsx                 # /dashboard — org selection landing (no org context)
│   │   │   ├── [orgSlug]/page.tsx        # /dashboard/[orgSlug] — canonical org dashboard
│   │   │   ├── [orgSlug]/sponsor-sentinel/page.tsx # /dashboard/[orgSlug]/sponsor-sentinel — stub
│   │   │   ├── organizations/page.tsx    # /dashboard/organizations — list own orgs
│   │   │   └── organizations/new/page.tsx # /dashboard/organizations/new — create org
│   ├── api/
│   │   ├── health/          # GET /api/health
│   │   ├── cron/<job>/      # Bearer-auth cron jobs (Vercel Cron)
│   │   └── webhooks/<provider>/ # Stripe/Razorpay (signature + idempotency)
│   ├── auth/callback/       # Supabase Auth code exchange
│   ├── layout.tsx           # Root layout — imports globals.css
│   ├── page.tsx             # Marketing landing
│   ├── not-found.tsx
│   └── error.tsx
│
├── components/
│   ├── ui/                  # Design-system primitives (Button, Input, Card, …)
│   ├── layout/              # Header, Footer, DashboardShell
│   └── shared/              # Cross-feature shared UI (OrgSwitcher)
│
├── features/                # Domain isolation — one folder per microtool
│   └── sponsor-sentinel/    # Example template (components/schemas/services/…)
│
├── lib/
│   ├── auth/                # getCurrentUser, requireOrganizationMember, requireOrganizationContext, requireEntitlement
│   ├── supabase/            # client (browser), server, admin, middleware
│   ├── env/                 # Typed env validation (serverSchema, clientSchema)
│   ├── validation/          # Zod helpers + common schemas
│   ├── errors/              # AppError hierarchy, toErrorResponse, handleRouteError
│   └── utils/               # cn(), formatDate, slugify…
│
├── server/
│   ├── repositories/        # DB access — one file per table/domain
│   ├── services/            # Business logic — pure, testable, no HTTP
│   ├── integrations/        # Vendor boundaries — twitch, discord, stripe, razorpay
│   ├── billing/             # Provider-agnostic billing contracts
│   └── cron/                # Cron helpers (assertCronAuth)
│
├── config/
│   ├── app/tools.ts         # Tool registry — source of truth for nav/catalog
│   └── navigation/          # marketingNav, dashboardNav
│
├── types/
│   ├── database.ts          # Hand-written until `npm run db:types`
│   └── index.ts
│
└── styles/
    └── globals.css          # Tailwind 4 + design tokens (@theme)

supabase/
├── config.toml              # Local Supabase config
├── migrations/              # SQL migrations (schema, RLS, seed)
└── seed.sql                 # Local dev seed
```

**Rule:** Do not create empty folders for appearance. Create a folder when you have a concrete file for it.

---

## 3. Domain Boundaries

Each microtool is isolated:

```
features/<slug>/
├── components/   — tool-specific UI
├── schemas/      — Zod schemas for this tool
├── services/     — business logic
├── repositories/ — DB access for this tool's tables
├── types/        — tool-specific types
└── index.ts      — public barrel (only export via this)
```

- No cross-tool imports except via public barrel.
- `app/(dashboard)/dashboard/<slug>/page.tsx` orchestrates: auth → membership → entitlement → service → render. It contains almost no logic.

Only the **pattern** is established now — no tool business logic is implemented yet (per RCCF instructions).

---

## 4. Authentication

- **Supabase Auth + @supabase/ssr**
- Secure **httpOnly cookies** (not localStorage)
- Correct split:
  - `src/lib/supabase/client.ts` — browser client (`createBrowserClient`) — anon key only, safe for Client Components
  - `src/lib/supabase/server.ts` — server client (`createServerClient` + `cookies()`) — for Server Components / Route Handlers / Server Actions
  - `src/lib/supabase/admin.ts` — `createAdminClient()` with `SUPABASE_SERVICE_ROLE_KEY` — **bypasses RLS**, only in `server/` contexts (webhooks, cron)
  - `src/lib/supabase/middleware.ts` — `updateSession()` — session refresh in `middleware.ts` at repo root
- Root `middleware.ts` refreshes session on every request.
- `src/lib/auth/get-user.ts` — `getCurrentUser()` (nullable) and `requireUser()` (throws 401) using `getUser()` (not `getSession()`).

---

## 5. Authorization (separate layers)

Three distinct checks — **never combine into one helper**:

1. **Authentication** — "Who is this user?" → `getCurrentUser()` / `requireUser()` — `src/lib/auth/get-user.ts:1`
2. **Membership** — "Is user in this organization? What role?" → `requireOrganizationMember()`, `requireOrganizationRole()` — `src/lib/auth/require-membership.ts:1`
3. **Entitlement** — "Does org have access to this tool (per-tool or all-access)?" → `requireEntitlement()`, `getOrganizationEntitlements()`, `getAccessibleToolSlugs()` — `src/lib/auth/require-entitlement.ts:1`

Entitlement resolution is **data-driven**:
- `tool_entitlements` row with `is_all_access = true` + `tool_id = null` → grants every active tool
- `tool_entitlements` row with `is_all_access = false` + `tool_id = <id>` → grants single tool
- Checked via DB function `has_tool_access(org_id, tool_slug)` (RLS) or service fallback. Expired entitlements (`expires_at < now()`) are excluded.

`src/server/services/entitlement-service.ts:1` provides `resolveEntitlements()` — pure business logic for tests.

### Sponsorship access model (Phase 3: user-scoped commercial access)

- Sponsorship Tracking (`sponsor-sentinel`) is the deliberate exception: its **commercial access is user-scoped**, everything else stays organization-scoped.
- Access = membership (organization authorization) + (legacy org grant OR valid `user_tool_entitlements` row) + org-scoped RLS (data authorization). A user grant never grants data or cross-org access by itself.
- New organizations provision **owner membership only** — `handle_new_organization()` no longer auto-grants `sponsor-sentinel` (`supabase/migrations/20251021000001_*`). Legacy org rows remain during the dual-read transition; they are not deleted by this phase.
- Grandfathering is owner-only (`organizations.owner_id` ∪ `role='owner'` members, exact expiry copy, `source='manual'`, idempotent) — see the migration file header.
- Background paths (scan cron, webhook pipeline, YouTube targeted scan) resolve org coverage via `hasSponsorshipAccessForOrg()` (`src/server/services/sponsorship-access.ts:1`): legacy org grant OR any owner's valid user grant. No browser session assumed; data stays org-scoped.
- Purchases still provision organization-level entitlements via `complete_billing_payment` (orders have no user linkage — user-level purchase provisioning is deferred, not redesigned here).

---

## 6. Multi-Tenancy & Canonical Organization Context

```
User ─→ OrganizationMembership ─→ Organization ─→ ToolEntitlements ─→ Tool Data
```

- Every tenant-owned record has `organization_id`.
- **Never trust `organization_id` or `?organizationId=` from client input.**
- **Canonical context is URL slug:** `/dashboard/[orgSlug]/...` is identifier, NOT authorization.
- Server resolves `orgSlug` → `findOrganizationBySlug` `src/server/repositories/organizations.ts:15` → verifies `organization_members` `src/lib/auth/organization-context.ts:12`.
- `organizations.slug` is human-readable; `id` (uuid) is the security boundary.

### Canonical flow (every future feature must follow)

```
URL orgSlug → requireOrganizationContext(orgSlug) → requireEntitlement(orgId, tool) → service → repository
```

```ts
// src/lib/auth/organization-context.ts:12
export interface OrganizationContext {
  organization: { id: string; name: string; slug: string };
  membership: { role: "owner"|"admin"|"member"; id: string };
  user: User;
}
export async function requireOrganizationContext(orgSlug: string): Promise<OrganizationContext>
```

- Guarantees: authenticated, org exists, user is member, role known. Caller can safely assume invariants.
- Uses repository `findOrganizationContext` `src/server/repositories/organizations.ts:32` (RLS-aware) + admin fallback to distinguish 404 vs 403 without leaking via RLS.
- **Why not `?organizationId=`:** query params are easily spoofed/forged; URL slug is still verified server-side, but slug is bookmarkable and typedRoutes-friendly. `organizationId` never accepted from client JSON/body without membership check.

### Dashboard routing conventions

- `/dashboard` — **org selection landing** (no org context). Lists `getUserOrganizations` `src/lib/auth/require-membership.ts:70`, links to `/dashboard/[orgSlug]`, shows EmptyState if none. Documented as landing, not competing tenant route.
- `/dashboard/organizations` — list own orgs (same data, Card grid).
- `/dashboard/organizations/new` — create org via Server Action `createOrgAction` `src/app/(dashboard)/dashboard/organizations/new/page.tsx:12` → `createOrganizationForUser` `src/server/services/organization-service.ts:11` (validates `createOrganizationSchema`, slugify) → `redirect(/dashboard/[slug])`.
- `/dashboard/[orgSlug]` — **canonical org dashboard** `src/app/(dashboard)/dashboard/[orgSlug]/page.tsx:1` — `requireOrganizationContext` → render org header + tools.
- `/dashboard/[orgSlug]/sponsor-sentinel` — **stub** `src/app/(dashboard)/dashboard/[orgSlug]/sponsor-sentinel/page.tsx:1` — `requireOrganizationContext` → `requireEntitlement(orgId,'sponsor-sentinel')` → placeholder Card. No Twitch/billing.
- Old `/dashboard/sponsor-sentinel` is **obsolete** (no file, no links); links now use `/dashboard/${orgSlug}/${tool.slug}` via `getDashboardNav` `src/config/navigation/index.ts:18`.

### Organization switching

- `src/app/(dashboard)/layout.tsx:1` fetches `getUserOrganizations` server-side, maps to `{id,name,slug}`, passes to `DashboardShell` `src/components/layout/dashboard-shell.tsx:1`.
- `DashboardShell` is `"use client"` and uses `useParams()` to detect `orgSlug`, selects `getDashboardNav(orgSlug)` vs `dashboardNav`, renders `OrgSwitcher` `src/components/shared/org-switcher.tsx:1` in sidebar + header.
- `OrgSwitcher` is client, receives `organizations` prop (never queries Supabase directly), navigates to `/dashboard/${org.slug}` on click. Server revalidates membership on next request — client never authority.

### Primary Workspace (per-user preference, not authorization)

- `profiles.primary_organization_id → organizations(id)`, nullable, `ON DELETE SET NULL` — `supabase/migrations/20251019000001_primary_workspace.sql:1`.
- One value per user; many users may prefer the same organization. No `organizations.is_primary`, no Creator/Agency tables.
- Organization = creator workspace by product convention; connected channels stay inside the organization.
- Setting requires membership in the target org (`requireOrganizationMember`), updates only the caller's own profile row (`profiles_update_own` RLS), and changes no ownership, membership, entitlement, billing, or data — `src/server/services/primary-workspace-service.ts:1`.
- Deleting a primary organization NULLs the preference via FK; nothing is moved or re-pointed automatically.
- URL `orgSlug` remains authoritative for the current page; primary is display/purchase-routing preference only and is never consulted by `has_tool_access`, `requireEntitlement`, service ownership checks, or RLS.

### Junior example: new org-scoped feature

```
Create route under /dashboard/[orgSlug]/my-tool/page.tsx
  → const {orgSlug}=await params; const ctx=await requireOrganizationContext(orgSlug);
  → await requireEntitlement(ctx.organization.id, "my-tool");
  → const data = await myToolService(supabase, ctx.organization.id);
  → return <MyToolUI data={data} />
```

---

## 7. RLS Strategy

- RLS **enabled on every tenant table** (`profiles`, `organizations`, `organization_members`, `tools`, `subscriptions`, `tool_entitlements`, `webhook_events`)
- Helper functions (**SECURITY DEFINER, fixed search_path, STABLE**) avoid recursive policy bugs:
  - `is_org_member(uuid)` — `supabase/migrations/20250930000002_rls.sql:1`
  - `is_org_admin(uuid)`
  - `is_org_owner(uuid)`
  - `has_tool_access(uuid, text)` — entitlement check
- Policies:
  - `profiles` — user can read own + org peers; update own only
  - `organizations` — select if member; insert if `owner_id = auth.uid()`; update if admin/owner; delete if owner
  - `organization_members` — select if member or self; insert/update/delete only if admin (plus self-leave)
  - `tools` — anon/auth read if `is_active = true`; no client writes (service_role only)
  - `subscriptions` / `tool_entitlements` — select if member; no client writes
  - `webhook_events` — no client policies at all (service_role bypass)
- **No `SECURITY DEFINER` on tables** — only on narrow helper functions, granted to `authenticated`.

See `supabase/migrations/20250930000002_rls.sql` for full policies.

### Super Admin & Audit (ADMIN-02 → ADMIN-09, hardened ADMIN-10A)

**Platform role:**
- `platform_admins (user_id PK → profiles.id)` — no anon/auth RLS policies (default deny); `is_super_admin() SECURITY DEFINER stable search_path=public` checks `auth.uid()`. Service_role bypasses RLS; app gate is `requireSuperAdmin()` → `rpc is_super_admin` (401 unauthenticated, 403 non-admin). No email/env/client flag.

**Authorization boundary (defense in depth):**
```
request → layout requireSuperAdmin() → page requireSuperAdmin() → service requireSuperAdmin() → createAdminClient() → SELECT
```
`createAdminClient()` is server-only (`src/lib/supabase/admin.ts`) and is banned in `src/app/(admin)/**` client components via `eslint no-restricted-imports`. Tenant tables keep `is_org_member` RLS; admin uses service_role **after** app auth, no tenant policy broadening.

**Audit log — append-only:**
- Table `admin_audit_logs (id, actor_user_id → profiles, action ~ '^[a-z_]+\.[a-z_]+$', target_type 2–40, target_id, organization_id, reason, before jsonb, after jsonb, ip inet, created_at)` — RLS `admin_audit_select_super_admin using (is_super_admin())`, no anon/auth INSERT/UPDATE/DELETE.
- **Database hardening** `20251014000002_admin_audit_append_only.sql` adds `BEFORE UPDATE/DELETE` triggers `prevent_admin_audit_mutation()` that `RAISE EXCEPTION 'admin_audit_logs is append-only'` for **all roles including service_role**. INSERT remains allowed via trusted path.
- **Trusted write path only:**
```
authorized admin operation → requireSuperAdmin() → controlled server operation → recordAdminAudit({action:"resource.action", targetType, ... before/after safe}) → INSERT admin_audit_logs
```
Normal admin UI pages **never** write to `admin_audit_logs` (read-only). `recordAdminAudit()` validates `ACTION_RE`, `target_type` length, rejects `FORBIDDEN_KEYS` (password, token, secret, api_key, etc.) in before/after, validates IP.

**Sensitive-data projection:**
- Raw `before/after` jsonb is potentially sensitive and must never be rendered directly (`JSON.stringify(raw)` / `<pre>` is forbidden).
- Mandatory boundary: `src/server/admin/audit-log.ts:15` `safeAuditProjection(raw)` → `{entries:[{key,value}], omitted, empty}`.
- Contract: `FORBIDDEN_SUBSTRINGS` (password, password_hash, access_token, refresh_token, oauth_token, secret, webhook_secret, razorpay_signature, service_role, api_key, client_secret, private_key, credential, token, cookie, session, hash) — case-insensitive substring, one-level depth, 20-entry limit, 200-char truncation, nested forbidden → omitted. UI renders `entries` dl and shows `+ N sensitive field(s) omitted` when `omitted>0`. All 8 admin surfaces follow same pattern; audit detail uses this projection.
- Metric vs data errors: metric failure → `Unavailable`; query failure → `Unable to load {resource}.` (with period); empty → `No {resource} found.` — raw Supabase/Postgres errors never exposed.

See `supabase/migrations/20251014000001_platform_admin_foundation.sql` + `20251014000002_admin_audit_append_only.sql` and `src/server/admin/audit-log.ts`.

---

## 8. Environment Variables

Typed via Zod — `src/lib/env/schema.ts:1`:

- `serverSchema` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (required), plus optional `CRON_SECRET`, `STRIPE_*`, `RAZORPAY_*`, `TWITCH_*`, `DISCORD_*`
- `clientSchema` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME` (optional)

- `src/lib/env/server.ts:1` — `getServerEnv()` / lazy `serverEnv` — validates on first use, cached, throws readable error. Import only server-side.
- `src/lib/env/client.ts:1` — `clientEnv` — safe for Client Components, only `NEXT_PUBLIC_` vars.
- Placeholders only in `.env.example` — never commit secrets.
- Server-only vars never prefixed `NEXT_PUBLIC_`.

---

## 9. Server / Client Boundaries

- Default: **Server Components**. No `"use client"` unless needed (interaction, browser APIs, local state, forms).
- Client components handle UI state only; never DB access or secrets.
- `createBrowserClient` vs `createServerClient` vs `createAdminClient` enforces boundary.

---

## 10. Integrations

All vendors isolated behind boundaries — business logic depends on app contracts:

```
server/integrations/twitch/client.ts   — TwitchClient, createTwitchClient()
server/integrations/discord/client.ts  — sendDiscordWebhook()
server/integrations/stripe/client.ts   — getStripeConfig() (future Checkout/Webhook)
server/integrations/razorpay/client.ts — getRazorpayConfig()
```

Do not scatter `fetch` to Twitch/Stripe across services. Add methods inside the integration client.

---

## 11. Billing Boundaries

Not fully implemented — conceptual architecture established:

- `server/billing/provider.ts:1` — `BillingProvider` interface (`createCheckoutSession`, `verifyWebhook`)
- `server/billing/index.ts:1` — `getBillingProvider(name)` factory — no `if (stripe)` scattered in services
- `subscriptions` table is provider-agnostic (`provider: 'stripe'|'razorpay'`)
- `tool_entitlements.subscription_id` links entitlement to subscription; `source` distinguishes `subscription|manual|promo`
- Webhooks: `/api/webhooks/stripe` and `/api/webhooks/razorpay` — stubs showing signature verification + `webhook_events` idempotency pattern

---

## 12. Cron Architecture

- Route: `/api/cron/<job>` — e.g., `src/app/api/cron/example-job/route.ts:1`
- Auth: `Authorization: Bearer <CRON_SECRET>` via `src/server/cron/cron-auth.ts:1` (`assertCronAuth`)
- Server-only, idempotent, structured logs (`console.log` with `[cron:<job>]`), safe failure via `handleRouteError`
- Delegates to services, not giant route handlers
- Vercel Cron: add entry to `vercel.json`

---

## 13. Design System

- Tokens in `src/styles/globals.css:1` — `@theme` (semantic: `background`, `primary`, `destructive`, `border`, `radius`, …). Dark mode via `prefers-color-scheme`.
- Primitives in `src/components/ui/`:
  - `Button` (`button.tsx:1`) — variants `default|destructive|outline|secondary|ghost|link`, sizes, loading
  - `Input` (`input.tsx:1`), `Label` (`label.tsx:1`)
  - `Card` (`card.tsx:1`) — CardHeader/Title/Description/Content/Footer
  - `Badge` (`badge.tsx:1`), `Table` (`table.tsx:1`)
  - `Dialog` (`dialog.tsx:1`) — client, overlay, focus
  - `Dropdown` (`dropdown.tsx:1`) — lightweight, no external dep
  - `EmptyState` (`empty-state.tsx:1`), `LoadingState` (`loading-state.tsx:1`), `ErrorState` (`error-state.tsx:1`), `PageHeader` (`page-header.tsx:1`)
- Layout: `Header` (`components/layout/header.tsx:1`), `Footer`, `DashboardShell` (`dashboard-shell.tsx:1`)
- Shared: `OrgSwitcher` (`components/shared/org-switcher.tsx:1`) — client
- **Conventions:** `cn()` (`lib/utils/cn.ts:1`) for class merging; spacing/typography via Tailwind; no hardcoded scattered values; responsive by default.

---

## 14. Coding Conventions

- Strict TS (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- No `any`, no magic strings/numbers, no giant files/components
- Small cohesive modules, explicit names (`requireOrganizationMember` not `checkUser`)
- Errors: `AppError` hierarchy (`lib/errors/index.ts:1`) — codes `VALIDATION_ERROR|AUTHENTICATION_REQUIRED|FORBIDDEN|NOT_FOUND|CONFLICT|ENTITLEMENT_REQUIRED|INTEGRATION_ERROR|INTERNAL_ERROR` — `toErrorResponse` hides internals, `handleRouteError` logs server-side
- Validation: Zod, single source per domain (`lib/validation/index.ts:1` + feature `schemas/`), `parseOrThrow`
- Naming: `get*`, `require*`, `assert*`, `create*` — intent-revealing
- Server/client utils separated; no circular deps; no unnecessary abstractions

---

## 15. How to Add a New Microtool

1. Create folder:
    ```
    src/features/<new-tool>/
    ├── components/
    ├── schemas/    # Zod schemas
    ├── services/   # business logic
    ├── repositories/ # DB access if needed
    ├── types/
    └── index.ts    # public barrel
    ```
2. Add DB tables (if needed) via `supabase/migrations/YYYYMMDD_add_<tool>.sql`:
    - Every row has `organization_id uuid references organizations(id)`.
    - Enable RLS, add policies using `is_org_member(organization_id)`.
    - See `supabase/migrations/20250930000002_rls.sql` for pattern.
3. Seed tool catalog: add to `supabase/migrations/20250930000003_seed_tools.sql` and `src/config/app/tools.ts` (`TOOLS` array).
4. Add nav entry: tools appear automatically via `getDashboardNav(orgSlug)` `src/config/navigation/index.ts:18` (reads `TOOLS`), or add to `marketingNav` if public.
5. Create route: `src/app/(dashboard)/dashboard/[orgSlug]/<tool>/page.tsx`:
    ```ts
    // 1. const {orgSlug}=await params;
    // 2. const ctx=await requireOrganizationContext(orgSlug) // src/lib/auth/organization-context.ts:12
    // 3. await requireEntitlement(ctx.organization.id, "<tool-slug>")
    // 4. call service from src/features/<tool>/services
    // 5. render with components from src/features/<tool>/components
    ```
    Keep page to ~15 lines of orchestration. Never accept `organizationId` from body/query.
6. Add entitlements: grants inserted via `service_role` (billing webhook or manual service), never client.
7. Test: add `*.test.ts` near service, validate `is_org_member` RLS via SQL tests if needed.

---

## 16. How to Add a New Integration

1. Create `src/server/integrations/<vendor>/client.ts`:
   - Export typed client/class and `create<Brand>Client()` / `get<Brand>Config()`
   - All `fetch` / SDK calls inside this file
   - Read secrets via `process.env` (never expose via `NEXT_PUBLIC_`)
2. Define app-level contract in `src/server/billing/provider.ts` or vendor-agnostic interface if needed
3. Services import from integration boundary, not raw SDK:
   ```ts
   import { createTwitchClient } from "@/server/integrations/twitch/client";
   ```
4. Never scatter `if (vendor === ...)` in services — create provider-specific integration, resolve via factory.
5. Webhooks: create `src/app/api/webhooks/<vendor>/route.ts` — verify signature, check `webhook_events` idempotency, delegate to service.

---

## 17. How to Add a New Database Table Safely

1. Create migration `supabase/migrations/YYYYMMDD_description.sql`:
   ```sql
   create table public.my_table (
     id uuid primary key default gen_random_uuid(),
     organization_id uuid not null references public.organizations(id) on delete cascade,
     -- ... columns
     created_at timestamptz not null default now()
   );
   alter table public.my_table enable row level security;
   -- helper is_org_member already exists
   create policy "my_table_select_member" on public.my_table
     for select to authenticated using (public.is_org_member(organization_id));
   -- add insert/update/delete as needed, always via is_org_member / is_org_admin
   create index my_table_org_idx on public.my_table(organization_id);
   ```
2. Add types to `src/types/database.ts` (or regenerate via `npm run db:types` when Supabase project linked).
3. Create repository in `src/server/repositories/my-table.ts` — functions, not raw queries in services.
4. Test RLS: try accessing as member vs non-member; verify `service_role` bypass only where intended.
5. Run `supabase db reset` locally to verify migration idempotency.
6. Never enable RLS without policies (blocks all access) — add policies in same migration.

---

## Verification

- `npm run typecheck` — `tsc --noEmit` (strict, typedRoutes:true)
- `npm run lint` — eslint flat config with `next/core-web-vitals`
- `npm run test` — vitest (`src/lib/env/env.test.ts`, `src/server/services/entitlement-service.test.ts`, `src/lib/auth/organization-context.test.ts`, `src/lib/validation/validation.test.ts`)
- `npm run build` — Next.js production build (requires env vars — use `NEXT_PUBLIC_*` placeholders for CI preview)

Zero-cost infra: Supabase free tier, Vercel Hobby, no paid queues/observability. Cron via Vercel Cron (free), webhooks via Route Handlers.
