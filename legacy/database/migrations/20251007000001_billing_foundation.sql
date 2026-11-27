-- Billing foundation — manual monthly/yearly (RCCF-REVENUE-02)
-- Plans + Orders + Payments — immutable financial history, organization is billing boundary
-- No Razorpay calls in this phase; schema only.

-- ─────────────────────────────────────────────────────────────
-- Plans — catalog, not tenant-owned
-- ─────────────────────────────────────────────────────────────
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid references public.tools(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  billing_period text not null check (billing_period in ('monthly','yearly')),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Prevent duplicate active conceptual plans: one active per tool+period+currency, and one for All Access (tool_id null)
create unique index if not exists plans_tool_period_active_unique
  on public.plans(tool_id, billing_period, currency)
  where is_active = true and tool_id is not null;

create unique index if not exists plans_all_access_period_active_unique
  on public.plans(billing_period, currency)
  where is_active = true and tool_id is null;

create index if not exists plans_slug_idx on public.plans(slug);
create index if not exists plans_tool_idx on public.plans(tool_id) where tool_id is not null;
create index if not exists plans_active_idx on public.plans(is_active) where is_active = true;

alter table public.plans enable row level security;

drop policy if exists "plans_select_active_anon" on public.plans;
create policy "plans_select_active_anon"
  on public.plans for select
  to anon
  using (is_active = true);

drop policy if exists "plans_select_active_auth" on public.plans;
create policy "plans_select_active_auth"
  on public.plans for select
  to authenticated
  using (is_active = true);

-- No insert/update/delete for anon/authenticated — service_role only

-- ─────────────────────────────────────────────────────────────
-- Orders — immutable purchase intent, snapshot of price
-- ─────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  tool_id uuid references public.tools(id) on delete set null,
  is_all_access boolean not null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','paid','failed','expired')),
  razorpay_order_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger — reuse handle_updated_at
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

create index if not exists orders_org_idx on public.orders(organization_id);
create index if not exists orders_plan_idx on public.orders(plan_id);
create index if not exists orders_tool_idx on public.orders(tool_id) where tool_id is not null;
create index if not exists orders_status_idx on public.orders(status);
create unique index if not exists orders_razorpay_order_unique
  on public.orders(razorpay_order_id) where razorpay_order_id is not null;

alter table public.orders enable row level security;

drop policy if exists "orders_select_member" on public.orders;
create policy "orders_select_member"
  on public.orders for select
  to authenticated
  using (public.is_org_member(organization_id));

-- No insert/update/delete for authenticated/anon — service_role only

-- ─────────────────────────────────────────────────────────────
-- Payments — provider transaction, verified
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  razorpay_payment_id text unique,
  razorpay_signature text,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','authorized','captured','failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_org_idx on public.payments(organization_id);
create unique index if not exists payments_razorpay_payment_unique
  on public.payments(razorpay_payment_id) where razorpay_payment_id is not null;

alter table public.payments enable row level security;

drop policy if exists "payments_select_member" on public.payments;
create policy "payments_select_member"
  on public.payments for select
  to authenticated
  using (public.is_org_member(organization_id));

-- No insert/update/delete for authenticated/anon — service_role only
