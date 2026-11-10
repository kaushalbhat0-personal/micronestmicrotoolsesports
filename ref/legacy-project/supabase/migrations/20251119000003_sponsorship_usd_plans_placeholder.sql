-- MicroNest — Dodo international V1: Sponsorship Tracking USD plan rows.
--
-- COMMERCIAL APPROVAL REQUIRED — DO NOT ACTIVATE AS-IS.
--
-- This migration reserves the canonical USD plan identities for the
-- internationally purchasable tool (Sponsorship Tracking only):
--   - sponsorship-tracking-monthly-usd
--   - sponsorship-tracking-yearly-usd
-- Both rows reference the SAME tool (sponsor-sentinel) as the INR plans, so
-- they grant the SAME sponsor-sentinel entitlement via the existing
-- complete_dodo_payment math. They remain distinguishable from the INR plans
-- by slug AND currency. No other tool gets a USD row in V1.
--
-- PRICING STATUS: exact USD commercial prices have NOT been supplied for V1.
-- The amount_minor values below are INERT PLACEHOLDERS (1 minor unit) and the
-- rows are inserted with is_active = false, so:
--   - listActivePlans() never returns them (no storefront/upgrade exposure),
--   - createCheckoutOrder rejects them ("Invalid or inactive plan"),
--   - no order, payment, or entitlement can reference them.
-- Activation path (separate reviewed migration, commercial sign-off):
--   1. UPDATE amount_minor to the approved USD minor-unit price,
--   2. set is_active = true,
--   3. wire DODO_PRODUCT_SPONSORSHIP_TRACKING_{MONTHLY,YEARLY}_USD to the
--      dashboard-created Dodo products with matching price/currency/one-time
--      semantics (validated at checkout by validateDodoProduct, fail closed).
-- Until then the release is BLOCKED on commercial USD pricing.
--
-- Deterministic UUIDs continuing the catalog sequence; idempotent via
-- ON CONFLICT (slug) DO NOTHING. Historical catalog migrations untouched.

insert into public.plans (id, tool_id, name, slug, billing_period, amount_minor, currency, is_active)
values
  (
    'a1b2c3d4-1234-1234-1234-000000000013',
    (select id from public.tools where slug = 'sponsor-sentinel'),
    'Sponsorship Tracking — Monthly (USD)',
    'sponsorship-tracking-monthly-usd',
    'monthly',
    1,
    'USD',
    false
  ),
  (
    'a1b2c3d4-1234-1234-1234-000000000014',
    (select id from public.tools where slug = 'sponsor-sentinel'),
    'Sponsorship Tracking — Yearly (USD)',
    'sponsorship-tracking-yearly-usd',
    'yearly',
    1,
    'USD',
    false
  )
on conflict (slug) do nothing;

-- Fail loudly on conflicting linkage (tool / period / currency / inactive).
-- Amount is intentionally NOT pinned here: the placeholder is replaced by the
-- commercial activation migration. The is_active = false pin guarantees the
-- placeholder can never sell.
do $$
declare
  _sponsor_id uuid := (select id from public.tools where slug = 'sponsor-sentinel');
  _cnt int;
begin
  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-monthly-usd'
    and (tool_id is distinct from _sponsor_id or billing_period != 'monthly' or currency != 'USD' or is_active != false);
  if _cnt > 0 then raise exception 'Conflicting linkage for plan sponsorship-tracking-monthly-usd — expected sponsor-sentinel monthly USD inactive placeholder'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-yearly-usd'
    and (tool_id is distinct from _sponsor_id or billing_period != 'yearly' or currency != 'USD' or is_active != false);
  if _cnt > 0 then raise exception 'Conflicting linkage for plan sponsorship-tracking-yearly-usd — expected sponsor-sentinel yearly USD inactive placeholder'; end if;

  -- V1 scope guard: no other USD plan may exist (Sponsorship Tracking only).
  select count(*) into _cnt from public.plans
  where currency = 'USD' and slug not in ('sponsorship-tracking-monthly-usd', 'sponsorship-tracking-yearly-usd');
  if _cnt > 0 then raise exception 'Out-of-scope USD plan detected — V1 international is Sponsorship Tracking only'; end if;
end $$;
