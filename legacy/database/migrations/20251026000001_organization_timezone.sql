-- MicroNest — Canonical workspace timezone prerequisite (RCCF-FREEMIUM-PLATFORM-IMPLEMENT-06)
--
-- Establishes ONE server-authoritative organization/workspace timezone:
-- public.organizations.timezone (IANA identifier, e.g. 'Asia/Kolkata').
--
-- Why:
-- - Tie-Breaker Free requires a workspace-local calendar month. There is no
--   canonical org timezone today (IMPLEMENT-05 was correctly BLOCKED P0).
-- - APP_TIMEZONE ('Asia/Kolkata' in src/lib/utils/format.ts) is display-only
--   formatting and must NOT become quota authority.
-- - Sponsorship monthly checks are UTC-based (consume_free_check,
--   currentMonthStartIso) and MUST remain unchanged by this migration.
--
-- Properties:
-- - TEXT NOT NULL DEFAULT 'Asia/Kolkata' (existing rows backfilled; new rows
--   inherit the default; never inferred from browser/IP/locale/headers).
-- - Valid IANA enforcement via the authoritative Postgres catalog
--   (pg_timezone_names) through a STABLE validator + CHECK constraint.
--   No static timezone list in SQL or application code.
-- - Additive/configurational only: no row deletes, no id/slug/owner changes,
--   no membership/entitlement/billing changes, no RLS changes, no index
--   (point lookups already use the PK; no demonstrated query need).
--
-- Idempotent where practical (safe to replay in development).

-- ─────────────────────────────────────────────────────────────
-- 1. Validator (authoritative catalog: pg_timezone_names)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_valid_iana_timezone(tz text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

revoke all on function public.is_valid_iana_timezone(text) from public;
grant execute on function public.is_valid_iana_timezone(text) to authenticated, service_role, anon;

-- ─────────────────────────────────────────────────────────────
-- 2. Column (default covers new rows; backfill covers existing rows)
-- ─────────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- Defensive backfill: normally a no-op because the ADD COLUMN default fills
-- existing rows, but covers the case where the column already existed nullable
-- from a partial apply.
update public.organizations
set timezone = 'Asia/Kolkata'
where timezone is null;

-- Harden NOT NULL for the partial-apply case (ADD COLUMN above is skipped
-- when the column already exists, so enforce nullability explicitly).
do $$
begin
  begin
    alter table public.organizations alter column timezone set not null;
  exception when others then
    -- Column already NOT NULL or concurrent DDL; backfill above guarantees
    -- no NULLs remain, so this is safe to ignore on replay.
    null;
  end;
  begin
    alter table public.organizations alter column timezone set default 'Asia/Kolkata';
  exception when others then
    null;
  end;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. IANA enforcement (CHECK via the catalog validator)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_timezone_valid_iana'
  ) then
    alter table public.organizations
      add constraint organizations_timezone_valid_iana
      check (public.is_valid_iana_timezone(timezone));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — intentionally unchanged
--
-- organizations keeps its existing member/admin/owner policies. Timezone is
-- configuration/data only, never an authorization primitive. No new client
-- write policy is added here; no customer-facing timezone setting exists in
-- this phase.
-- ─────────────────────────────────────────────────────────────
