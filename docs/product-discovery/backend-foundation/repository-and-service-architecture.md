# Repository & Service Architecture **[Proposed]**

For the implementation phase: where code lives and what it may do. Mirrors the approved modular-monolith direction; no code written here.

## Layers (dependency flows downward only)

`app/` routes (orchestration: auth → permission → service → render, ~15 lines) → `features/<domain>/` (components, Zod schemas, services; cross-feature imports via public barrel only) → `server/` (repositories = DB access, services = pure logic, integrations = vendor boundary) → `lib/` (auth, supabase clients, env, validation, errors, utils).

## Proposed modules

`identity` (profiles), `players` (player + game profiles, verification display), `teams` (teams, memberships, captain actions), `organizations` (orgs, members, divisions, recruiter actions), `brands` (brands, representatives), `opportunities` (engine + per-type validation), `applications` (lifecycle + queues), `trust` (verification, reports, strikes, moderation), `news`, `tournaments`, `notifications`, `platform-admin`, shared `ui`.

## Repository rules

- One repository file per table/domain; functions take explicit ids + acting user id, never trust client entity ids.
- Repositories perform membership-scoped queries only; product rules live in services.
- All `service_role` usage confined to `server/` contexts (webhooks, cron, moderation triage, notification fan-out) after app-level authorization.
- New RPCs: `SECURITY DEFINER`, fixed `search_path`, least-privilege EXECUTE, single-purpose (quota consume, status transition, share fetch, membership mutation) — copy the live RPC shape, not its anon grants.

## Service rules

Pure, testable, no HTTP/fetch (vendors behind `server/integrations/`); Zod `parseOrThrow` at every boundary mirroring SQL CHECKs; unique-violation codes mapped to safe conflict messages; `{ok, message}` action returns via the `AppError` hierarchy.
