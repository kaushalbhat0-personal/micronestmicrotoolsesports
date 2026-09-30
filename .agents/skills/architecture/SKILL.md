---
name: architecture
description: "Use before any code change. Enforces MicroNest's authoritative folder architecture, main-file orchestration rule, SOLID/DRY/KISS, and feature isolation."
---

# Architecture — Project Authority

**When to use:** Every task that touches `src/`, creates routes, adds DB tables, adds features, or reviews code. Load first.

**When not to use:** Pure docs typo fix with no code/structure impact (still skim invariants).

**Installed context:** Next.js `15.4.2` App Router, React `19.1`, TypeScript `5.8.3` strict, Tailwind `4.1.11`. Do not assume newer APIs.

## Invariants

- **SOLID / DRY / KISS / Separation of Concerns.** Small cohesive modules. No premature abstraction, no monolith files, no circular deps, junior-readable names (`requireOrganizationMember` not `checkUser`).
- **Dependency direction:** `app → lib/server/features`, `server/services → repositories`, `features → lib/server` (never feature → feature internals). `components` are leaves.

## Folder Authority

```
src/app/            orchestration only (get context → call service → pass data → render)
src/features/<slug>/ domain capability
src/server/repositories/ DB access (one file per table/domain)
src/server/services/  business/application logic (pure, testable)
src/server/integrations/ external provider boundaries (twitch/discord/stripe/razorpay)
src/lib/             cross-cutting infra (auth, supabase, env, errors, validation, utils)
src/components/ui/    design system primitives (Button, Input, Card, …)
src/components/shared/ shared application UI (OrgSwitcher)
src/config/           configuration (tools, navigation)
src/types/            shared types
src/styles/           tokens (globals.css @theme)
```

Create a folder only when it has a concrete file. Do not create empty folders for appearance.

## Critical Rule: Main Files Contain Main Code Only

Pages/layouts/route handlers are ~15 lines:

1. establish context (`requireUser` / `requireOrganizationContext`)
2. call services (`resolveEntitlements`, feature service)
3. pass data
4. render/return

They must not contain raw complex queries, business rules, provider SDK calls, large transforms, duplicated validation/auth.

**Good:**

```ts
// src/app/(dashboard)/dashboard/[orgSlug]/page.tsx
export default async function OrgDashboardPage({ params }: { params: Promise<{orgSlug:string}> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  const tools = await listActiveTools(supabase);
  return <OrgUI ctx={ctx} tools={tools} />;
}
```

**Bad:** Same file with `supabase.from("organizations").select(...)`, `if (role !== "owner")`, `fetch("https://id.twitch.tv/...")`, `z.object({slug:...}).parse(...)` inline, 200 lines.

## Feature Isolation

```
features/<tool-slug>/
├── components/
├── schemas/       # Zod, single source
├── services/      # business logic
├── repositories/  # DB for this tool
├── types/
└── index.ts       # public barrel — only export via this
```

- No cross-tool internal imports (`features/sponsor-sentinel/services/` → `features/prize-splitter/...` forbidden).
- Shared concerns → `lib/` or `server/` or `components/shared/`, not copied between features.
- New tool must not require restructuring unrelated domains.

## Canonical Tenant Flow

```
URL orgSlug → requireOrganizationContext(orgSlug) → requireEntitlement(orgId, tool) → service → repository
```

Every new org-scoped feature follows it. See `security` skill for why `?organizationId=` is never trusted.

## Adding Code — Checklist

- [ ] Did I put DB access in `server/repositories/`?
- [ ] Business logic in `server/services/` or `features/.../services/`?
- [ ] Validation in `src/lib/validation/` or `features/.../schemas/` (single source)?
- [ ] Reused `components/ui/` primitives, not duplicated?
- [ ] `typedRoutes:true` — fixed links properly, no `as never`?
- [ ] `strict` + `exactOptionalPropertyTypes` — no `any`/`as any`?

See `ARCHITECTURE.md` §2/§3/§6 and `src/features/sponsor-sentinel/README.md`.
