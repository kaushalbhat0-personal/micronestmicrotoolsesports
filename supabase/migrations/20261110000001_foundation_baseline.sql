-- MicroNest Esports greenfield foundation: baseline infrastructure.
--
-- Scope (deliberately minimal):
--   1. Required extension setup (pgcrypto for gen_random_uuid()).
--   2. Shared updated_at trigger helper with explicit search_path.
--   3. Minimal baseline schema grants (Supabase defaults, stated explicitly).
--
-- Explicitly NOT included here (sequenced per
-- docs/product-discovery/backend-foundation/implementation-sequence.md):
--   - No product tables (profiles, teams, organizations, brands,
--     opportunities, applications, news, tournaments).
--   - No audit tables yet (arrive with the identity migration).
--   - No speculative helpers or views.
--   - Storage buckets live in 20261110000002_storage_foundation.

-- 1. Extensions -----------------------------------------------------------
create schema if not exists extensions;

create extension if not exists "pgcrypto" with schema extensions;

-- 2. Timestamp helper ------------------------------------------------------
-- Single canonical trigger function for updated_at columns.
-- SECURITY INVOKER (default) + empty search_path: only pg_catalog builtins
-- (e.g. now()) resolve. No application-table access by design.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger functions must not be directly callable by API roles.
-- (Triggers still fire on DML; EXECUTE revocation only blocks direct calls.)
revoke all on function public.handle_updated_at() from public;
revoke all on function public.handle_updated_at() from anon;
revoke all on function public.handle_updated_at() from authenticated;

-- 3. Baseline grants ---------------------------------------------------------
-- Restate Supabase platform defaults explicitly so the greenfield lineage
-- never depends on implicit behavior. Per-table GRANTs arrive with each
-- domain migration (no auto-expose reliance).
grant usage on schema public to anon, authenticated, service_role;
