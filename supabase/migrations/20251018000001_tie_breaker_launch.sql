-- Tie-Breaker Resolver — Launch catalog (RCCF-TIEBREAKER-08)
-- Tool row + 2 plans (monthly 79900 / yearly 799000 INR). All Access covers
-- tie-breaker automatically via has_tool_access (is_all_access branch) — no extra wiring.
-- Additive; does not modify the V1 catalog or draft-ban launch migrations. Idempotent via ON CONFLICT.

insert into public.tools (slug, name, description, is_active) values
  ('tie-breaker', 'Tie-Breaker Resolver', 'Official standings for tied competitions — explained, locked, shareable', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.plans (id, tool_id, name, slug, billing_period, amount_minor, currency, is_active)
values
  (
    'a1b2c3d4-1234-1234-1234-000000000009',
    (select id from public.tools where slug = 'tie-breaker'),
    'Tie-Breaker Resolver — Monthly',
    'tie-breaker-monthly',
    'monthly',
    79900,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000010',
    (select id from public.tools where slug = 'tie-breaker'),
    'Tie-Breaker Resolver — Yearly',
    'tie-breaker-yearly',
    'yearly',
    799000,
    'INR',
    true
  )
on conflict (slug) do nothing;

do $$
declare
  _tie_id uuid := (select id from public.tools where slug = 'tie-breaker');
  _cnt int;
begin
  select count(*) into _cnt from public.plans
  where slug = 'tie-breaker-monthly'
    and (tool_id is distinct from _tie_id or billing_period != 'monthly' or amount_minor != 79900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan tie-breaker-monthly — expected tie-breaker monthly 79900 INR active'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'tie-breaker-yearly'
    and (tool_id is distinct from _tie_id or billing_period != 'yearly' or amount_minor != 799000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan tie-breaker-yearly'; end if;
end $$;
