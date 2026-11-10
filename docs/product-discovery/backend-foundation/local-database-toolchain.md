# Local Database Toolchain **[Proposed]**

## PG17 live vs PG15 local

`supabase/config.toml` pins `major_version = 15`; live runs Postgres 17. No PG15-only syntax observed in reviewed migrations, but new RPC work must target the live engine.

**[Proposed]** Align local to live: set `major_version = 17` (config change at implementation time, not now), verify Supabase CLI version supports PG17 images, and re-run the staging replay proof on 17. If CLI images lag, pin the newest supported major and record the delta as a **[Risk]** for `is_valid_iana_timezone`-style catalog-dependent functions.

## Migration testing

- Staging replay proof (from baseline strategy) runs `supabase db reset` on a scratch project/branch and diffs catalog (tables, columns, constraints, policies, functions, triggers) against the live inventory in `backend-parity/live-schema-inventory.md`.
- New migrations must be reset-clean: apply in order on empty DB with zero errors, including the duplicate-version fix.

## Type generation (`db:types` fix, D-18)

Current script broken three ways: sh-only `$SUPABASE_PROJECT_ID` (fails on PowerShell), `--project-id` pulls from live (couples typegen to production), output path `src/types/database.ts` is archived.

**[Proposed]** Replace with a local-first workflow: `supabase gen types typescript --local --schema public > src/types/database.ts` (new greenfield path), run after local reset; document live-linked typegen as a fallback requiring explicit project id via cross-platform env handling (e.g. `cross-env` or documented sh-only note — no new dependency without approval; preference: `--local` only). Regenerate on every migration change; hand-edits to generated types prohibited (legacy `database.ts` was hand-written and incomplete — do not repeat).

## CI lanes (retain)

Keep the existing split: unit lane excludes `*.integration.test.ts`; integration lane (`embedded-postgres` + `pg`, 60s test / 180m hook timeouts) runs RLS/lifecycle/migration tests. New DB tests go in the integration lane near the migration they cover. No toolchain changes needed beyond the above.
