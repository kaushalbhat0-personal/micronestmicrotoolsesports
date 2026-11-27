-- MicroNest — User-scoped Sponsorship grants (RCCF-MULTI-SCOPE-IMPLEMENT-02)
--
-- Explicit user-level product grants, fenced by service-layer convention to
-- Sponsorship Tracking. Operational tools (Draft & Ban, Tie-Breaker Resolver,
-- Prize Pool Splitter) and All Access never consult this table.
--
-- Grant semantics mirror tool_entitlements: expires_at IS NULL means lifetime.
-- A user grant means "this user may use Sponsorship Tracking in organizations
-- where they are a member" — it never grants data access by itself. Sponsorship
-- DATA tables and their RLS (is_org_member) are untouched by this migration.
--
-- Staged transition: existing organization-level Sponsorship grants keep working.
-- No backfill, no conversion, no trigger changes in this migration.
--
-- Idempotent where practical (safe to replay in development).

-- ─────────────────────────────────────────────────────────────
-- 1. Table — explicit user grants, never a mixed user/org table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_tool_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  source text not null default 'subscription' check (source in ('subscription','manual','promo')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  -- One grant row per user per tool (same convention as tool_entitlements).
  unique (user_id, tool_id)
);

create index if not exists user_tool_entitlements_user_idx
  on public.user_tool_entitlements(user_id);
create index if not exists user_tool_entitlements_tool_idx
  on public.user_tool_entitlements(tool_id);

alter table public.user_tool_entitlements enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. RLS — users read only their own rows; writes are server-controlled
--
-- No INSERT / UPDATE / DELETE policies for authenticated: grant writes go
-- through service_role / SECURITY DEFINER paths only, so no user can
-- self-grant Sponsorship or modify another user's grant. Existing
-- sponsorship DATA table policies are not touched by this migration.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "user_entitlements_select_own" on public.user_tool_entitlements;
create policy "user_entitlements_select_own"
  on public.user_tool_entitlements for select
  to authenticated
  using (user_id = auth.uid());
