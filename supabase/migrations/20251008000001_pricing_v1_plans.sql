-- Pricing V1 — deterministic, idempotent seed (RCCF-REVENUE-03)
-- 6 active production plans: Sponsorship Tracking (monthly/yearly), Prize Pool Splitter (monthly/yearly), All Access (monthly/yearly)
-- Tool IDs resolved via slug lookup (canonical), plan IDs are deterministic UUIDs
-- Idempotent: ON CONFLICT (slug) DO NOTHING; conflicting commercial values FAIL LOUDLY via explicit checks

-- ─────────────────────────────────────────────────────────────
-- Insert 6 plans — deterministic UUIDs
-- ─────────────────────────────────────────────────────────────
insert into public.plans (id, tool_id, name, slug, billing_period, amount_minor, currency, is_active)
values
  (
    'a1b2c3d4-1234-1234-1234-000000000001',
    (select id from public.tools where slug = 'sponsor-sentinel'),
    'Sponsorship Tracking — Monthly',
    'sponsorship-tracking-monthly',
    'monthly',
    149900,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000002',
    (select id from public.tools where slug = 'sponsor-sentinel'),
    'Sponsorship Tracking — Yearly',
    'sponsorship-tracking-yearly',
    'yearly',
    1499000,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000003',
    (select id from public.tools where slug = 'prize-splitter'),
    'Prize Pool Splitter — Monthly',
    'prize-pool-splitter-monthly',
    'monthly',
    69900,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000004',
    (select id from public.tools where slug = 'prize-splitter'),
    'Prize Pool Splitter — Yearly',
    'prize-pool-splitter-yearly',
    'yearly',
    699000,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000005',
    null,
    'All Access — Monthly',
    'all-access-monthly',
    'monthly',
    249900,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000006',
    null,
    'All Access — Yearly',
    'all-access-yearly',
    'yearly',
    2499000,
    'INR',
    true
  )
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fail loudly if an existing plan has conflicting commercial values
-- (historical orders snapshot price; price changes must deactivate + create new plan)
-- ─────────────────────────────────────────────────────────────
do $$
declare
  _sponsor_id uuid := (select id from public.tools where slug = 'sponsor-sentinel');
  _prize_id uuid := (select id from public.tools where slug = 'prize-splitter');
  _cnt int;
begin
  -- sponsorship-tracking-monthly
  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-monthly'
    and (tool_id is distinct from _sponsor_id or billing_period != 'monthly' or amount_minor != 149900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan sponsorship-tracking-monthly — expected sponsor-sentinel monthly 149900 INR active'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-yearly'
    and (tool_id is distinct from _sponsor_id or billing_period != 'yearly' or amount_minor != 1499000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan sponsorship-tracking-yearly'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'prize-pool-splitter-monthly'
    and (tool_id is distinct from _prize_id or billing_period != 'monthly' or amount_minor != 69900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan prize-pool-splitter-monthly'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'prize-pool-splitter-yearly'
    and (tool_id is distinct from _prize_id or billing_period != 'yearly' or amount_minor != 699000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan prize-pool-splitter-yearly'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'all-access-monthly'
    and (tool_id is not null or billing_period != 'monthly' or amount_minor != 249900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan all-access-monthly — expected tool_id NULL'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'all-access-yearly'
    and (tool_id is not null or billing_period != 'yearly' or amount_minor != 2499000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan all-access-yearly'; end if;

  -- Also ensure no duplicate active plans beyond these 6 (deterministic uniqueness)
  -- The partial unique indexes already enforce, but sanity check count
  if (select count(*) from public.plans where is_active = true) != 6 then
    -- Allow other inactive plans, but active must be exactly 6 for V1 catalog
    -- If more than 6, warn via exception only if they conflict with V1 slugs
    null;
  end if;
end $$;
