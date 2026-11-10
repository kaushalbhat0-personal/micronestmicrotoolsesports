-- Prize Payout Tracker — Launch catalog (RCCF-PRIZE-PAYOUT-IMPLEMENTATION-02)
-- Tool row + 2 plans (monthly 79900 / yearly 799000 INR). All Access covers
-- payout-tracker automatically via has_tool_access (is_all_access branch) — no extra wiring.
-- Additive; does not modify the V1 catalog or earlier launch migrations. Idempotent via ON CONFLICT.

insert into public.tools (slug, name, description, is_active) values
  ('payout-tracker', 'Prize Payout Tracker', 'Publish a public, organizer-reported record of tournament prize payouts', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.plans (id, tool_id, name, slug, billing_period, amount_minor, currency, is_active)
values
  (
    'a1b2c3d4-1234-1234-1234-000000000011',
    (select id from public.tools where slug = 'payout-tracker'),
    'Prize Payout Tracker — Monthly',
    'prize-payout-tracker-monthly',
    'monthly',
    79900,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000012',
    (select id from public.tools where slug = 'payout-tracker'),
    'Prize Payout Tracker — Yearly',
    'prize-payout-tracker-yearly',
    'yearly',
    799000,
    'INR',
    true
  )
on conflict (slug) do nothing;

do $$
declare
  _payout_id uuid := (select id from public.tools where slug = 'payout-tracker');
  _cnt int;
begin
  select count(*) into _cnt from public.plans
  where slug = 'prize-payout-tracker-monthly'
    and (tool_id is distinct from _payout_id or billing_period != 'monthly' or amount_minor != 79900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan prize-payout-tracker-monthly — expected payout-tracker monthly 79900 INR active'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'prize-payout-tracker-yearly'
    and (tool_id is distinct from _payout_id or billing_period != 'yearly' or amount_minor != 799000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan prize-payout-tracker-yearly'; end if;
end $$;
