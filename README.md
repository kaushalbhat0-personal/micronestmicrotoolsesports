# MicroNest Esports

**Discover the people, teams, organizations and brands shaping esports.**

MicroNest Esports is a discovery and opportunity platform connecting
players, teams, organizations, and brands through recruitment and
partnership opportunities. News, tournaments, and mini games are
supporting sections.

## Status

Greenfield foundation. Application shell, health check, error boundaries,
layout, and Supabase client boundaries only. No discovery features
implemented yet.

## Quickstart

1. Copy `.env.example` to `.env.local` and fill values (never commit secrets).
2. `npm install`
3. `npm run dev`

## Scripts

- `npm run dev` — local development server.
- `npm run build` — production build.
- `npm run typecheck` — strict TypeScript check.
- `npm run lint` — ESLint.
- `npm run test` — Vitest unit lane (excludes `*.integration.test.ts`).
- `npm run test:all` — all unit tests.
- `npm run db:types` — regenerate `src/types/database.ts` from the local
  Supabase stack (requires `supabase start`).

## Structure

- `src/app/` — App Router shell (layout, home, health check, error boundaries).
- `src/components/ui/` — shared primitives (shadcn-style foundations).
- `src/components/shared/` — site chrome (header, footer, container).
- `src/features/` — domain features (not implemented yet).
- `src/lib/` — browser-safe utilities and Supabase browser/server clients.
- `src/server/` — server-only code (service-role admin client, server env).
- `src/config/`, `src/types/` — site config and generated database types.
- `supabase/` — fresh greenfield backend (new migration lineage).
- `legacy/` — read-only legacy reference. Never import from it.
- `docs/product-discovery/` — approved product and backend architecture.

## Supabase boundaries

- Browser: `src/lib/supabase/client.ts` (anon key only).
- Server: `src/lib/supabase/server.ts` (cookie-scoped, anon key only).
- Admin: `src/server/supabase-admin.ts` (service-role, server-only, throws
  in the browser).

## Validation

See the greenfield foundation report for branch, Supabase identity,
archive verification, environment inventory, and validation results.
