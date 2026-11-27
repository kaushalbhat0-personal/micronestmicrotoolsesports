-- Draft & Ban — Launch catalog (RCCF-DRAFT-BAN-04 P7)
-- Tool row + 2 plans (monthly 79900 / yearly 799000 INR). All Access covers
-- draft-ban automatically via has_tool_access (is_all_access branch) — no extra wiring.
-- Additive; does not modify the V1 catalog migration. Idempotent via ON CONFLICT.

insert into public.tools (slug, name, description, is_active) values
  ('draft-ban', 'Draft & Ban', 'Professional match draft room — run vetoes and lock official records', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

insert into public.plans (id, tool_id, name, slug, billing_period, amount_minor, currency, is_active)
values
  (
    'a1b2c3d4-1234-1234-1234-000000000007',
    (select id from public.tools where slug = 'draft-ban'),
    'Draft & Ban — Monthly',
    'draft-ban-monthly',
    'monthly',
    79900,
    'INR',
    true
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000008',
    (select id from public.tools where slug = 'draft-ban'),
    'Draft & Ban — Yearly',
    'draft-ban-yearly',
    'yearly',
    799000,
    'INR',
    true
  )
on conflict (slug) do nothing;

do $$
declare
  _draft_id uuid := (select id from public.tools where slug = 'draft-ban');
  _cnt int;
begin
  select count(*) into _cnt from public.plans
  where slug = 'draft-ban-monthly'
    and (tool_id is distinct from _draft_id or billing_period != 'monthly' or amount_minor != 79900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan draft-ban-monthly — expected draft-ban monthly 79900 INR active'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'draft-ban-yearly'
    and (tool_id is distinct from _draft_id or billing_period != 'yearly' or amount_minor != 799000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'Conflicting values for plan draft-ban-yearly'; end if;
end $$;
