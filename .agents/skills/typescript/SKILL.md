---
name: typescript
description: "Use for strict typing in this repo — no any/as any/as never, explicit contracts, exactOptionalPropertyTypes. Keep types readable, not clever."
---

# TypeScript — Strict (5.8.3)

**When to use:** Any `.ts`/`.tsx` change, defining types, fixing `tsc`, reviewing PRs.

**When not to use:** Pure CSS or static asset with no TS.

**Source:** Adapted from PyModel React Frontend Skills — `typescript` skill (MIT) + project invariants. Installed **TS 5.8.3** with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.

## Rules

**Rule: No escape hatches**
Why: Catches tenant/RLS bugs.
Good: `src/lib/errors/index.ts:17` `override cause?: unknown` + `super(msg,{cause})` — typed, no `as unknown`.
Bad: ` (this as unknown as {cause:unknown}).cause = ...` or `supabase as any` — fix with `CookieOptions` `src/lib/supabase/server.ts:1`.

**Rule: Allow `any` only at narrow third-party boundary, isolated + documented**
Why: Some libs mismatch `exactOptionalPropertyTypes`.
Good: `src/lib/supabase/server.ts:22` `setAll(cookies: {name,value,options:CookieOptions}[])` — `CookieOptions` from `@supabase/ssr`, comment explains Supabase↔Next adaptation, no `as any`.
Bad: ` (cookieStore.set as any)(...)` scattered without comment — consolidate to one helper.

**Rule: `exactOptionalPropertyTypes` — pass `undefined` correctly**
Why: Prevents `string | undefined` assigned to `string`.
Good: `src/components/shared/org-switcher.tsx:14` `activeOrgId?: string | undefined` — allows `undefined` when no active org. In call, `activeOrgId={activeOrg?.id}` where `activeOrg?.id` is `string|undefined` matches.
Bad: `activeOrgId?: string` + `activeOrgId={maybeUndefined}` → TS2375. Fix type to `| undefined` or omit prop via spread.

**Rule: Explicit contracts, narrow types**
Why: Junior-readable, catches `organizationId` spoofing.
Good: `src/lib/auth/organization-context.ts:12` `OrganizationContext { organization: {id,name,slug}, membership:{role,id}, user }` — minimal, not `any`. `src/lib/validation/index.ts:16` `createOrganizationSchema` Zod source of truth.
Bad: `(data as any).organization` — define `type Org = {id:string...}` and cast `as unknown` once at repository boundary with comment.

**Rule: Type-only imports, readable generics**
Why: Bundle, clarity.
Good: `import type { Route } from "next"` for `NavItem.href: Route` `src/config/navigation/index.ts:4`. `type Result<T,E>` `src/types/index.ts:1` discriminated union, not deep conditional hack.
Bad: 4-level generic `DeepPartial<Require<...>>` for simple `PaginationParams` — use explicit `type PaginationParams {page:number,pageSize:number}`.

## Checklist

- [ ] `npm run typecheck` passes with `strict` + `exactOptionalPropertyTypes`? No `as any`/`as never`/`@ts-ignore`?
- [ ] Return types on exported functions where useful, type guards over casts?
- [ ] `tsconfig.json:1` paths `@/*` used, not relative `../../../`?
- [ ] `Route` for `Link href` when `typedRoutes:true` `next.config.ts:1`?

See `tsconfig.json:1`, `ARCHITECTURE.md` §14.
