# Legacy Project Archive — Reference Only

This directory preserves the complete pre-greenfield MicroNest project as
reference material. Do not import from it. Do not treat it as the new
architecture.

## Layout

- `application/` — previous `ref/legacy-platform/` contents (legacy Next.js
  application, tests, assets, docs, demos, middleware, legacy `vercel.json`,
  legacy GitHub ingestion workflows).
- `supabase/` — previous root `supabase/` backend (legacy `config.toml`,
  all 58 historical migrations, legacy `seed.sql`). Preserved exactly as
  reference. The active greenfield backend lives at root `supabase/` with a
  fresh migration lineage.
- `toolchain/` — previous root toolchain and build configuration
  (`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`,
  `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`,
  `vitest.config.ts`, `.prettierrc`, `.prettierignore`, legacy
  `.env.example`). Placeholder values only. No secrets were copied.
- `deployment/` — reserved for legacy deployment notes. The legacy Vercel
  cron configuration is preserved at
  `application/vercel.json`. The active greenfield `vercel.json` remains at
  the repository root with no cron jobs.

## Rules

- Read-only reference. No legacy application imports in the new application.
- No secrets in this archive. The active `.env` was never moved or copied.
- Local machine state (`supabase/.temp/`, `node_modules/`, generated caches)
  was not archived.
- Product documentation for the new platform lives under
  `docs/product-discovery/` at the repository root.
