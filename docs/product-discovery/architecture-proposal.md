# Architecture Proposal (Modular Monolith)

**[Recommendation]** throughout. No code or config changed in this phase.

## Choice: modular monolith first

Next.js App Router + Supabase Postgres/Auth/RLS, one deployable, domain-oriented modules. Microservices, separate BFFs, and event buses are explicitly rejected for MVP — the existing backend already proves this shape scales to the current scope at zero infra cost.

## Layers and dependency direction

```text
app/ (routes: orchestration only — auth → permission → service → render)
  → features/<domain>/ (components, schemas, services; public barrel only)
  → server/ (repositories: DB access; services: pure logic; integrations: vendor boundary)
  → lib/ (auth, supabase clients, env, validation, errors, utils)
```

Rules: routes contain ~15 lines of orchestration, no business logic; no cross-feature imports except via barrel; services never touch HTTP; repositories never enforce product rules (only membership-scoped queries); vendors live behind `server/integrations/<vendor>/client.ts`; billing stays behind a provider interface.

## Domain boundaries (proposed)

`identity` (users/profiles), `players` (profiles + game profiles), `teams` (teams + memberships), `organizations` (orgs + memberships + divisions), `brands` (brands + representatives), `opportunities` (engine + applications), `trust` (verification + reports + moderation), `news`, `tournaments`, `engagement` (mini games, deferred), `platform-admin`, shared `ui` design system.

## Cross-cutting

- **Auth:** Supabase Auth + `@supabase/ssr` httpOnly cookies; three clients (browser/server/admin) with the existing split; `getCurrentUser`/`requireUser` at boundaries.
- **Authorization:** server-side only; slug/entity → membership/rep check → entitlement-free (no paywalled discovery in MVP **[Open]**) → service → RLS as final boundary.
- **Validation:** Zod at every boundary (route params, forms, server actions, RPC inputs); unknown enum/filter values ignored or rejected with safe messages; `AppError` hierarchy with user-safe messages, server-side logging.
- **Errors/audit:** user-safe `{ok, message}` action returns; admin writes audit-logged; application lifecycle transitions logged.
- **SEO/mobile/a11y:** server-rendered public views, canonical URLs, JSON-LD without PII, `noindex` for private/applicant surfaces; mobile-first responsive; design-system primitives before feature UI.
- **Testing:** unit (services/matching/permissions), RLS integration via embedded-postgres lane (existing harness pattern), route smoke tests for visibility rules; no coverage theater.

## Toolchain: retain / clean later

- Retain **[Recommendation]**: Next 15 + React 19 + strict TS (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), Tailwind 4, ESLint 9 flat config, Vitest + embedded-postgres lane, Supabase CLI flow, `ref/**` exclusions.
- Clean later (recommendations, not actions): drop stale `next.config.ts` `/tools/*` redirects when routing lands; fix `db:types` output path + Windows-incompatible `$VAR` syntax; decide on `dodopayments`/`razorpay` deps (unused in greenfield); add `globals.css` import on first UI pass; keep the `(admin)` eslint future-guard.
- Hosting: Vercel Hobby + Supabase (existing project) + Vercel Cron only when expiry sweeps need it; no new infra.

## What this architecture deliberately omits

Chat, feeds, comments, payments/escrow, brackets, notification delivery infra, multi-region, and read-replicas. Each has a named later phase or an explicit non-goal.
