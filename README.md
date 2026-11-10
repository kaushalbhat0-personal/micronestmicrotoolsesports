# MicroNest Esports — Greenfield Workspace

Esports discovery and opportunity platform. This branch (`new-platform`)
is a clean greenfield workspace prepared for a platform rebuild.

## Archive

The complete legacy implementation is preserved as reference material under:

`ref/legacy-platform/`

- `ref/legacy-platform/src/` — legacy application code (including tests).
- `ref/legacy-platform/public/` — legacy assets.
- `ref/legacy-platform/docs/` — legacy product documentation and mockups.
- `ref/legacy-platform/demos/` — legacy demo tooling.
- `ref/legacy-platform/scripts/` — legacy product scripts.
- `ref/legacy-platform/ARCHITECTURE.md` — legacy architecture.
- `ref/legacy-platform/README.md` — legacy readme.
- `ref/legacy-platform/middleware.ts` — legacy Next.js middleware.
- `ref/legacy-platform/vercel.json` — legacy cron configuration.
- `ref/legacy-platform/.github/workflows/` — legacy ingestion workflows.

Do not import legacy application code into the new `src/`. The archive is
reference-only and is excluded from TypeScript compilation and lint.

## Backend foundation

The existing `supabase/` directory (configuration, migrations, seed) is
retained unchanged at the repository root as the backend starting point.
No new Supabase project was created. No migrations, auth changes, or
resets were made in this task.

Environment files (`.env`, `.env.example`) were left untouched.

## New structure (minimal)

- `src/` — new application, initially only `app/layout.tsx` and
  `app/page.tsx` (placeholder, no product features).
- `public/` — new platform assets (currently empty placeholder).
- `docs/` — new product and architecture docs (currently `README.md` only).
- `supabase/` — existing backend foundation, unchanged.
- `.github/` — reviewed workflows (legacy automation deactivated, see
  `.github/workflows/README.md`).
- `vercel.json` — minimal greenfield config with no cron jobs. Legacy
  cron config preserved at `ref/legacy-platform/vercel.json`.

## Toolchain

Retained: `package.json`, `package-lock.json`, `tsconfig.json`,
`next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
`.prettierrc`, `.prettierignore`, `.gitignore`, `next-env.d.ts`,
`vitest.config.ts`.

- `tsconfig.json` excludes `ref/**` so archived legacy source is not
  compiled as part of the new application.
- `eslint.config.mjs` ignores `ref/**` for the same reason (rules
  unchanged).
- `next.config.ts` is unchanged (legacy `/tools/*` redirects retained for
  now, documented as legacy reference).
- `npm run demo:generate` and `npm run dodo:validate-products` reference
  archived `demos/` and `scripts/` targets and are expected to fail until
  greenfield tooling is defined. `npm run db:types` targets the archived
  `src/types/database.ts` path and is likewise expected to need revision.

No product features (Player Finder, Team Finder, Org Finder, Brand Finder
or others) have been implemented. No dependencies were installed or
upgraded.

## Validation

See the task final report for branch, checkpoint, archive verification,
Supabase preservation, environment inventory, and validation results.
