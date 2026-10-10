# .agents — Project Skills Index

> **What `.agents` is:** Project-local authoritative skills for OpenCode and future agents. Model memory is not trusted; these files are the source of truth for how this repository is built.

## Authority & Scope

- **Project-owned (authoritative):** `architecture`, `security`, `ui-ux`, plus project-bounded provider skills `twitch`, `youtube`, `kick` — encode MicroNest rules. If any external skill conflicts, **project wins** unless changed via RCCF.
- **Framework guidance (supplemental):** `nextjs`, `react`, `typescript`, `tailwind`, `supabase`, `postgres-rls`, `testing`, `playwright` — version-aware, narrow, used only when relevant. Never allow generic framework advice to override security/architecture.

External skills are **small + authoritative + relevant** over large + generic. Verify source/license/freshness before importing.

## Installed Versions (authoritative, do not migrate via skill)

- Next.js `15.5.26` lockfile (range `^15.4.2`, App Router, `typedRoutes:true`), React `19.1`, TypeScript `5.8.3` (strict), Tailwind `4.1.11`, Supabase JS `2.48` + SSR `0.6.1`, Vitest `3.2.7` (range `^3.2.4`), Playwright `1.63` (installed). Skills target these versions; newer APIs must not be assumed.

## When to Load Each Skill

| Skill | Load when |
|-------|-----------|
| `architecture` | **Always** before any code change — enforces `app/=orchestration`, `features/` isolation, etc. |
| `security` | **Always** before auth/RLS/tenant/env/cron/webhook changes — enforces IDOR, RLS, secret handling |
| `nextjs` | App Router, Server Components, route handlers, Server Actions, caching, `typedRoutes` |
| `react` | Component design, composition, state/effect discipline (React 19) |
| `typescript` | Strict typing, contracts, `exactOptionalPropertyTypes`, no `any` |
| `tailwind` | Styling, tokens (`src/styles/globals.css`), responsive, primitives |
| `supabase` | Auth, SSR, DB, migrations, storage, CLI, troubleshooting |
| `postgres-rls` | **Before** any schema, index, RLS policy, function, or tenant-isolation change |
| `testing` | Writing/reviewing tests (Vitest) — unit lane (`npm run test`), integration lane (`npm run test:integration`), full (`npm run test:all`). Never run watch mode in agents. |
| `playwright` | E2E/browser testing (`@playwright/test` installed, no `playwright.config.ts` yet — init only when first E2E lands) |
| `ui-ux` | Any UI change — design-system-first, a11y, responsive, states |
| `twitch` | Twitch Helix/EventSub changes under `src/server/integrations/twitch/` (real provider live, mock fallback via registry) |
| `youtube` | YouTube Data API v3 changes under `src/server/integrations/youtube/` (real provider live, mock fallback via registry) |
| `kick` | Kick Public API changes under `src/server/integrations/kick/` (real provider live, mock fallback; VOD NOT_SUPPORTED) |

`discord` / `stripe` / `razorpay` have real integration clients (`src/server/integrations/<vendor>/client.ts`) but no dedicated skills yet — treat the client file + `registry.ts` as source of truth and do not hallucinate provider APIs. Directory convention: `.agents/skills/<provider>/SKILL.md`.

## Skill Precedence (high → low)

1. **Security constraints** (`security`)
2. **Project architecture** (`architecture`)
3. **Explicit task requirements** (RCCF prompt)
4. **Database/RLS invariants** (`postgres-rls`, `supabase`)
5. **Framework guidance** (`nextjs`, `react`, `typescript`, `tailwind`)
6. **General optimization** (if not covered above)

## Project Architecture Invariants (enforced)

- **Main files contain main code only**: pages/layouts/route handlers do (1) establish context, (2) call services, (3) pass data, (4) render. No raw complex queries, business rules, SDK calls, or duplicated auth. See `architecture` skill for Good/Bad examples.
- **Folder authority**: `src/app/` orchestration, `src/features/<slug>/` domain capability, `src/server/repositories/` DB, `src/server/services/` business logic, `src/server/integrations/` vendor boundaries, `src/lib/` cross-cutting, `src/components/ui/` design system, `src/components/shared/` shared UI, `src/config/` config. Do not mix.
- **Feature isolation**: `features/<slug>/{components,schemas,services,repositories,types,index.ts}` — no cross-tool internal imports.
- **Tenant invariant**: `URL orgSlug → requireOrganizationContext → requireEntitlement → service → repository`. `organizationId` from client is never trusted; RLS is DB enforcement boundary. See `security` skill.
- **Typed routes**: `typedRoutes:true` — fix links properly, no `as never`/`as any`.

## RCCF Workflow (skills are support, not replacement)

```
Task → Repository inspection (ARCHITECTURE.md, src, migrations) → Load relevant skills →
RCCF plan → Implementation → Verification (typecheck/lint/test/build) → RCCF audit → Commit checkpoint
```

A skill must never authorize skipping inspection, security checks, typecheck, tests, build, or RCCF verification.

## Adding/Updating Skills

- **Project skills** (`architecture`, `security`, `ui-ux`): edit directly, keep concise, version-aware, junior-readable. Include Rule/Why/Good/Bad where useful.
- **Framework skills**: prefer upstream exact content when license permits, preserve attribution, keep focused, verify freshness/compatibility with installed versions.
- External import checklist: source, license, scope, freshness, compatibility, conflict with project architecture.
- Use `references/` only when detailed material is actually needed; keep `SKILL.md` actionable.
- Every skill must state **When to use / When not to use**.

## References

- `ARCHITECTURE.md` — authoritative folder/auth/RLS/entitlement/tokens
- `src/features/sponsor-sentinel/README.md` — feature template
- `supabase/migrations/` — schema/RLS source of truth
- `.agents/skills/<name>/SKILL.md` — per-skill rules
