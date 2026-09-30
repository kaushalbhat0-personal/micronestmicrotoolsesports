---
name: security
description: "Use before any auth, RLS, tenant, env, webhook, cron, or user-input change. Enforces secure-by-default, least privilege, and tenant isolation."
---

# Security — Project Authority

**When to use:** Any change to `src/lib/auth/`, `src/lib/supabase/`, `src/lib/env/`, `supabase/migrations/`, route handlers, API routes, cron, webhooks, or handling of secrets/user input.

**When not to use:** Pure UI text/style with no auth/data/env impact (still keep server/client boundary).

## Invariants (secure-by-default)

- No secrets in source, logs, or `.env.example` (placeholders only). Server-only vars never `NEXT_PUBLIC_`. `SUPABASE_SERVICE_ROLE_KEY` never client. No tokens in `localStorage` — httpOnly cookies via `@supabase/ssr` only.
- Least privilege: `service_role` only in `src/lib/supabase/admin.ts` server contexts (webhooks, cron). `anon` with RLS for all client/server browser paths.
- Input validation: Zod `parseOrThrow` for all external input (API, forms, webhooks, query). Single source per domain.
- Safe errors: `AppError` `src/lib/errors/index.ts:1` → `toErrorResponse` hides internals, never leak stack/DB.

## Layered Authorization (separate layers, never one giant helper)

```
Authentication → Membership → Role → Entitlement → Domain operation
```

- **Authentication:** `getCurrentUser()` / `requireUser()` `src/lib/auth/get-user.ts:1` via `getUser()` (not `getSession()`), cookie-based.
- **Membership:** `requireOrganizationMember(orgId)` / `requireOrganizationRole` `src/lib/auth/require-membership.ts:1` — `organization_members` check. Centralized.
- **Entitlement:** `requireEntitlement(orgId, toolSlug)` `src/lib/auth/require-entitlement.ts:1` — data-driven `tool_entitlements` (`is_all_access` vs `tool_id`) + `has_tool_access` DB function. Centralized.

Do not scatter `if (user.id === owner)` across UI. Do not duplicate checks.

## Tenant Invariant (IDOR/BOLA prevention)

> **A client-provided `organizationId` is never trusted as proof of authorization.**

**Canonical (only) flow:**

```
URL orgSlug → findOrganizationBySlug → verify organization_members → trusted organization.id → authorize
```

- `src/lib/auth/organization-context.ts:12` `requireOrganizationContext(orgSlug)` guarantees `user authenticated + org exists + user is member + role known`. Future features call it, then `requireEntitlement`.
- Never accept `?organizationId=<uuid>` or body `organization_id` without membership verification. Derive `organization_id` from session/context.
- RLS is DB enforcement: all tenant tables RLS enabled, helper functions `is_org_member`/`is_org_admin`/`has_tool_access` `supabase/migrations/20250930000002_rls.sql:1` are `SECURITY DEFINER` with `search_path=public`, `stable`, granted to `authenticated` only. `webhook_events` has no client policies (service_role only). Client filtering alone is not isolation.

## Webhook / Cron

- **Webhooks:** verify signature (`STRIPE_WEBHOOK_SECRET` / `RAZORPAY_*`), insert `webhook_events(provider_event_id unique)` for idempotency, delegate to billing service. See `src/app/api/webhooks/stripe/route.ts:1`.
- **Cron:** `Authorization: Bearer <CRON_SECRET>` via `assertCronAuth` `src/server/cron/cron-auth.ts:1`, server-only, idempotent, `handleRouteError`, `vercel.json` cron.

## Checklist Before Committing

- [ ] No `SUPABASE_SERVICE_ROLE_KEY` / `STRIPE_SECRET_KEY` / `CRON_SECRET` in client code or logs?
- [ ] `requireOrganizationContext` (or membership) called for every org-scoped route/action?
- [ ] RLS policies unchanged or — if changed — reviewed via `postgres-rls` skill?
- [ ] Zod validation on all untrusted input?
- [ ] Errors via `handleRouteError`, no stack/DB leak?

See `ARCHITECTURE.md` §4/§5/§6/§7 and `supabase/migrations/`.
