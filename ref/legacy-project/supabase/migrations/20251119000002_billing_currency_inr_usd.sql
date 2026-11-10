-- MicroNest — Dodo international V1: allow USD alongside INR in billing money columns.
--
-- The billing foundation (20251007000001) constrains plans/orders/payments
-- currency to INR-only via inline CHECKs (auto-named <table>_currency_check).
-- International V1 (Sponsorship Tracking, USD) genuinely requires USD in the
-- same three columns. This migration widens ONLY those three money columns
-- to ('INR','USD'):
--   - public.plans.currency
--   - public.orders.currency
--   - public.payments.currency
-- No other currency column is touched (e.g. payout-tracker settlement
-- currency already supports its own set and is unrelated to billing).
--
-- Preservation: defaults stay 'INR'; every existing value ('INR') remains
-- valid; no rows are modified; INR prices/mappings are unchanged. Historical
-- migrations are untouched. Deterministic and idempotent.

-- ── plans.currency ──
alter table public.plans drop constraint if exists plans_currency_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_currency_inr_usd_check') then
    alter table public.plans add constraint plans_currency_inr_usd_check
      check (currency in ('INR','USD'));
  end if;
end $$;

-- ── orders.currency (order snapshots the plan price at purchase) ──
alter table public.orders drop constraint if exists orders_currency_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_currency_inr_usd_check') then
    alter table public.orders add constraint orders_currency_inr_usd_check
      check (currency in ('INR','USD'));
  end if;
end $$;

-- ── payments.currency (verified provider charge) ──
alter table public.payments drop constraint if exists payments_currency_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_currency_inr_usd_check') then
    alter table public.payments add constraint payments_currency_inr_usd_check
      check (currency in ('INR','USD'));
  end if;
end $$;

comment on constraint plans_currency_inr_usd_check on public.plans is 'Billing catalog currency: INR (India) or USD (international V1, Sponsorship Tracking only). No auto-conversion.';
comment on constraint orders_currency_inr_usd_check on public.orders is 'Order snapshot currency must equal its plan currency; INR or USD.';
comment on constraint payments_currency_inr_usd_check on public.payments is 'Verified charge currency must equal its order currency; INR or USD.';
