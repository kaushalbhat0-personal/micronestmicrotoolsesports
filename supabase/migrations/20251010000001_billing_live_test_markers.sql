-- Billing LIVE test markers — temporary gated ₹1 verification (RCCF-REVENUE-LIVE-TEST-IMPL-01)
-- Adds explicit audit columns to distinguish controlled test transactions from commercial ones.
-- Does NOT modify plans catalog, billing_period, currency, tool_id, or amount_minor checks.
-- Test flag is on financial records (orders/payments), not entitlement semantics (source remains 'subscription').

alter table public.orders add column if not exists is_live_test boolean not null default false;
alter table public.payments add column if not exists is_live_test boolean not null default false;

-- Partial index for audit/reporting — only test rows indexed, zero cost for normal traffic
create index if not exists orders_is_live_test_idx on public.orders(is_live_test) where is_live_test = true;
create index if not exists payments_is_live_test_idx on public.payments(is_live_test) where is_live_test = true;

-- Scoped index to enforce single-use protection query (org + plan) for test orders
create index if not exists orders_test_org_plan_idx on public.orders(organization_id, plan_id) where is_live_test = true;

comment on column public.orders.is_live_test is 'Controlled LIVE test marker — true only for gated ₹1 test orders (BILLING_LIVE_TEST_ENABLED). Normal commercial orders remain false.';
comment on column public.payments.is_live_test is 'Mirrors orders.is_live_test — true only when payment completes a gated ₹1 test order.';
