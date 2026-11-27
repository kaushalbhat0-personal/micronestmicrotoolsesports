-- MicroNest — Dodo international V1: activate Sponsorship Tracking USD plans.
--
-- APPROVED COMMERCIAL ACTIVATION (V1):
--   sponsorship-tracking-monthly-usd → amount_minor = 1900  ($19.00 USD)
--   sponsorship-tracking-yearly-usd  → amount_minor = 19000 ($190.00 USD)
-- INR prices and all other plans are NOT touched by this migration.
--
-- This migration UPDATES the inactive placeholder rows created by
-- 20251119000003 (same UUIDs, same slugs, same sponsor-sentinel tool,
-- currency stays USD) and flips is_active to true. No new rows are inserted;
-- ON CONFLICT-free UPDATEs only. Historical migrations are untouched.
--
-- Fail-closed guards: the migration raises (rolls back) if either USD row is
-- missing/duplicated, the tool binding drifted, the currency drifted, an
-- out-of-scope USD plan exists, or any INR commercial price drifted.
-- A partially-applied state is impossible (single transaction).
--
-- Post-apply requirements (outside this migration):
--   DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD → one-time USD $19.00 product
--   DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY_USD  → one-time USD $190.00 product
-- validated via scripts/dodo-validate-products.mjs before enabling traffic.

-- ── activate with approved commercial amounts (no exchange-rate derivation) ──
update public.plans
set amount_minor = 1900, is_active = true
where slug = 'sponsorship-tracking-monthly-usd';

update public.plans
set amount_minor = 19000, is_active = true
where slug = 'sponsorship-tracking-yearly-usd';

-- ── fail-closed verification ──
do $$
declare
  _sponsor_id uuid := (select id from public.tools where slug = 'sponsor-sentinel');
  _cnt int;
begin
  -- Exactly one row per USD slug, with the approved linkage, amount, and active flag.
  select count(*) into _cnt from public.plans where slug = 'sponsorship-tracking-monthly-usd';
  if _cnt != 1 then raise exception 'USD activation failed: sponsorship-tracking-monthly-usd missing or duplicated (%)', _cnt; end if;

  select count(*) into _cnt from public.plans where slug = 'sponsorship-tracking-yearly-usd';
  if _cnt != 1 then raise exception 'USD activation failed: sponsorship-tracking-yearly-usd missing or duplicated (%)', _cnt; end if;

  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-monthly-usd'
    and (id != 'a1b2c3d4-1234-1234-1234-000000000013'
      or tool_id is distinct from _sponsor_id
      or billing_period != 'monthly'
      or amount_minor != 1900
      or currency != 'USD'
      or is_active != true);
  if _cnt > 0 then raise exception 'USD activation failed: sponsorship-tracking-monthly-usd linkage/amount/flag mismatch (expected sponsor-sentinel monthly 1900 USD active)'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-yearly-usd'
    and (id != 'a1b2c3d4-1234-1234-1234-000000000014'
      or tool_id is distinct from _sponsor_id
      or billing_period != 'yearly'
      or amount_minor != 19000
      or currency != 'USD'
      or is_active != true);
  if _cnt > 0 then raise exception 'USD activation failed: sponsorship-tracking-yearly-usd linkage/amount/flag mismatch (expected sponsor-sentinel yearly 19000 USD active)'; end if;

  -- V1 scope guard: no other USD plan may exist (Sponsorship Tracking only).
  select count(*) into _cnt from public.plans
  where currency = 'USD' and slug not in ('sponsorship-tracking-monthly-usd', 'sponsorship-tracking-yearly-usd');
  if _cnt > 0 then raise exception 'USD activation failed: out-of-scope USD plan detected — V1 international is Sponsorship Tracking only'; end if;

  -- INR commercial prices must remain unchanged (Sponsorship Tracking).
  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-monthly'
    and (tool_id is distinct from _sponsor_id or billing_period != 'monthly' or amount_minor != 149900 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'USD activation failed: INR sponsorship-tracking-monthly was modified (must stay 149900 INR active)'; end if;

  select count(*) into _cnt from public.plans
  where slug = 'sponsorship-tracking-yearly'
    and (tool_id is distinct from _sponsor_id or billing_period != 'yearly' or amount_minor != 1499000 or currency != 'INR' or is_active != true);
  if _cnt > 0 then raise exception 'USD activation failed: INR sponsorship-tracking-yearly was modified (must stay 1499000 INR active)'; end if;
end $$;
