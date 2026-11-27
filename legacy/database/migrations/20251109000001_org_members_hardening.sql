-- MicroNest — Organization member hardening (RCCF-ORG-MEMBERS-01)
-- Makes Owner/Admin/Member a real, secure authorization model.
-- DO NOT APPLY AUTOMATICALLY — user applies manually.
--
-- Problem (audit R-01): organization_members RLS allowed any owner/admin to
-- insert/update/delete any member row (self-promotion to Owner, Owner
-- demotion/deletion) and allowed any user to delete their own row (sole-owner
-- self-leave → ownerless organization). All reachable via direct PostgREST.
--
-- After this migration:
--   §1 organization_audit_logs — org-scoped audit for membership mutations.
--   §2 protect_last_organization_owner() — BEFORE UPDATE/DELETE trigger:
--       the organization can never reach zero owners, including races
--       (LOCK TABLE serialises concurrent member mutations) and direct API.
--   §3 protect_organization_owner_id() — BEFORE UPDATE OF owner_id trigger:
--       owner_id changes only via transfer_organization_ownership()
--       (direct authenticated/service_role writes rejected; the transfer RPC
--       runs as postgres via SECURITY DEFINER).
--   §4 RLS tighten: direct member insert/update/delete policies are removed.
--       Member mutations go ONLY through the §5 RPCs (service_role-only
--       EXECUTE; functions run as postgres and bypass RLS). Reads unchanged.
--       Org creation is unaffected: handle_new_organization() is already
--       SECURITY DEFINER and keeps inserting the founder's owner row.
--   §5 Five SECURITY DEFINER RPCs (service_role only) implementing the
--       Owner/Admin/Member matrix with actor checks inside the transaction:
--       add_organization_member / remove_organization_member /
--       change_member_role / leave_organization /
--       transfer_organization_ownership (atomic).
--
-- Dual-authority doctrine preserved: organizations.owner_id and
-- organization_members.role='owner' both remain authoritative; transfer
-- updates both atomically. No backfill, no data rewrite, no unrelated change.

-- ─────────────────────────────────────────────────────────────
-- §1 organization_audit_logs — org-scoped membership audit
-- ─────────────────────────────────────────────────────────────
create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null check (char_length(action) between 3 and 60),
  target_user_id uuid references public.profiles(id) on delete set null,
  before_role text check (before_role is null or before_role in ('owner','admin','member')),
  after_role text check (after_role is null or after_role in ('owner','admin','member')),
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists org_audit_org_idx on public.organization_audit_logs(organization_id, created_at desc);
create index if not exists org_audit_actor_idx on public.organization_audit_logs(actor_user_id);

alter table public.organization_audit_logs enable row level security;

-- Members may read their own organization's history; writes are RPC-only.
drop policy if exists "org_audit_select_member" on public.organization_audit_logs;
create policy "org_audit_select_member"
  on public.organization_audit_logs for select
  to authenticated
  using (public.is_org_member(organization_id));

comment on table public.organization_audit_logs is 'Org-scoped audit for membership mutations (add/remove/role/leave/transfer). Written by member RPCs via service_role; readable by org members. Never stores secrets/tokens.';

-- ─────────────────────────────────────────────────────────────
-- §2 last-owner protection trigger (all roles, incl. service_role)
-- ─────────────────────────────────────────────────────────────
create or replace function public.protect_last_organization_owner()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_owners integer;
begin
  if TG_OP = 'DELETE' then
    v_org := OLD.organization_id;
  else
    v_org := NEW.organization_id;
  end if;

  -- Serialise concurrent member mutations so two simultaneous demotions
  -- or deletions can never both pass the check and yield zero owners.
  lock table public.organization_members in share row exclusive mode;

  if TG_OP = 'DELETE' then
    -- In BEFORE DELETE the row is still visible: <=1 means it is the last.
    if OLD.role = 'owner' then
      select count(*) into v_owners from public.organization_members
      where organization_id = v_org and role = 'owner';
      if v_owners <= 1 then
        raise exception 'organization must retain at least one owner' using errcode = 'P0001';
      end if;
    end if;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    -- Demotion away from owner, or move of an owner row to another org.
    if OLD.role = 'owner'
       and (NEW.role is distinct from 'owner' or NEW.organization_id is distinct from OLD.organization_id) then
      select count(*) into v_owners from public.organization_members
      where organization_id = OLD.organization_id and role = 'owner';
      if v_owners <= 1 then
        raise exception 'organization must retain at least one owner' using errcode = 'P0001';
      end if;
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists organization_members_last_owner on public.organization_members;
create trigger organization_members_last_owner
  before update or delete on public.organization_members
  for each row execute function public.protect_last_organization_owner();

comment on function public.protect_last_organization_owner() is 'DB-level last-owner invariant: blocks deletion/demotion of the final owner for all roles including service_role. Member mutations go through §5 RPCs; this trigger backstops direct API writes.';

-- ─────────────────────────────────────────────────────────────
-- §3 owner_id change guard (transfer RPC is the sole writer)
-- ─────────────────────────────────────────────────────────────
create or replace function public.protect_organization_owner_id()
returns trigger
language plpgsql
as $$
begin
  -- SECURITY DEFINER RPCs run as postgres (function owner); direct
  -- PostgREST writes run as authenticated/service_role and are rejected.
  -- The application never updates owner_id outside transfer_organization_ownership.
  if NEW.owner_id is distinct from OLD.owner_id and current_user <> 'postgres' then
    raise exception 'organizations.owner_id may only change via transfer_organization_ownership' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists organizations_owner_id_guard on public.organizations;
create trigger organizations_owner_id_guard
  before update of owner_id on public.organizations
  for each row execute function public.protect_organization_owner_id();

comment on function public.protect_organization_owner_id() is 'Blocks direct owner_id rewrites; transfer_organization_ownership (SECURITY DEFINER, runs as postgres) remains the sole writer.';

-- ─────────────────────────────────────────────────────────────
-- §4 RLS tighten: remove direct member write policies
-- ─────────────────────────────────────────────────────────────
-- Reads are unchanged (org_members_select_member). All writes now go
-- through the §5 RPCs, which enforce the Owner/Admin/Member matrix with
-- server-derived actor identity. service_role and SECURITY DEFINER
-- functions bypass RLS; org creation trigger is already SECURITY DEFINER.
drop policy if exists "org_members_insert_admin" on public.organization_members;
drop policy if exists "org_members_update_admin" on public.organization_members;
drop policy if exists "org_members_delete_admin" on public.organization_members;
drop policy if exists "org_members_leave_self" on public.organization_members;

-- ─────────────────────────────────────────────────────────────
-- §5 member-management RPCs (SECURITY DEFINER, service_role only)
-- ─────────────────────────────────────────────────────────────
-- Conventions: all take explicit p_actor (server-derived user id, never
-- client role claims). Domain failures return {ok:false,error:<code>};
-- only programming errors raise. Every mutation writes an audit row in the
-- same transaction. Role matrix:
--   add:      owner → member|admin;  admin → member;            member → deny
--   remove:   owner → admin|member (not self, not owners);
--             admin → member (not self);                        member → deny
--   change:   owner → member↔admin (never owner, never self via this path —
--             self change is rejected, use transfer to move ownership);
--             admin/member → deny (admins never assign roles)
--   leave:    any member except the sole owner (trigger backstops races)
--   transfer: current owner → member|admin of the SAME org (atomic)

create or replace function public.add_organization_member(
  p_org uuid,
  p_target uuid,
  p_role text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_exists boolean;
begin
  if p_org is null or p_target is null or p_actor is null then
    raise exception 'Invalid member parameters' using errcode = 'P0001';
  end if;
  if p_role is distinct from 'member' and p_role is distinct from 'admin' then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;
  perform 1 from public.organizations where id = p_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select role into v_actor_role from public.organization_members
  where organization_id = p_org and user_id = p_actor;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  if v_actor_role = 'owner' then
    -- owner may add member or admin (never owner: ownership moves by transfer)
    null;
  elsif v_actor_role = 'admin' and p_role = 'member' then
    -- admin may add members only
    null;
  else
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  perform 1 from public.profiles where id = p_target;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org and user_id = p_target
  ) into v_exists;
  if v_exists then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  lock table public.organization_members in share row exclusive mode;

  insert into public.organization_members (organization_id, user_id, role)
  values (p_org, p_target, p_role);

  insert into public.organization_audit_logs
    (actor_user_id, organization_id, action, target_user_id, before_role, after_role)
  values (p_actor, p_org, 'member.add', p_target, null, p_role);

  return jsonb_build_object('ok', true, 'role', p_role);
end;
$$;

create or replace function public.remove_organization_member(
  p_org uuid,
  p_target uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if p_org is null or p_target is null or p_actor is null then
    raise exception 'Invalid member parameters' using errcode = 'P0001';
  end if;
  if p_target = p_actor then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;
  perform 1 from public.organizations where id = p_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select role into v_actor_role from public.organization_members
  where organization_id = p_org and user_id = p_actor;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  select role into v_target_role from public.organization_members
  where organization_id = p_org and user_id = p_target;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_actor_role = 'owner' then
    -- owner may remove admins/members, never owners (transfer first)
    if v_target_role = 'owner' then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  elsif v_actor_role = 'admin' then
    -- admin may remove members only (never admins, never owners)
    if v_target_role is distinct from 'member' then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  lock table public.organization_members in share row exclusive mode;

  delete from public.organization_members
  where organization_id = p_org and user_id = p_target;

  insert into public.organization_audit_logs
    (actor_user_id, organization_id, action, target_user_id, before_role, after_role)
  values (p_actor, p_org, 'member.remove', p_target, v_target_role, null);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.change_member_role(
  p_org uuid,
  p_target uuid,
  p_role text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
begin
  if p_org is null or p_target is null or p_actor is null then
    raise exception 'Invalid member parameters' using errcode = 'P0001';
  end if;
  if p_role is distinct from 'member' and p_role is distinct from 'admin' then
    return jsonb_build_object('ok', false, 'error', 'invalid_role');
  end if;
  if p_target = p_actor then
    return jsonb_build_object('ok', false, 'error', 'self');
  end if;
  perform 1 from public.organizations where id = p_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select role into v_actor_role from public.organization_members
  where organization_id = p_org and user_id = p_actor;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  -- Only owners assign roles; admins never do (closes demote-then-remove
  -- and promote-then-transfer loopholes by construction).
  if v_actor_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select role into v_target_role from public.organization_members
  where organization_id = p_org and user_id = p_target;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  -- Owners move only between member and admin; ownership moves by transfer.
  if v_target_role = 'owner' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_target_role = p_role then
    return jsonb_build_object('ok', true, 'idempotent', true, 'role', p_role);
  end if;

  lock table public.organization_members in share row exclusive mode;

  update public.organization_members set role = p_role
  where organization_id = p_org and user_id = p_target;

  insert into public.organization_audit_logs
    (actor_user_id, organization_id, action, target_user_id, before_role, after_role)
  values (p_actor, p_org, 'member.role_change', p_target, v_target_role, p_role);

  return jsonb_build_object('ok', true, 'idempotent', false, 'role', p_role);
end;
$$;

create or replace function public.leave_organization(
  p_org uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_owners integer;
begin
  if p_org is null or p_actor is null then
    raise exception 'Invalid member parameters' using errcode = 'P0001';
  end if;
  perform 1 from public.organizations where id = p_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select role into v_actor_role from public.organization_members
  where organization_id = p_org and user_id = p_actor;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  -- Clean error for the sole owner; the trigger backstops races.
  if v_actor_role = 'owner' then
    select count(*) into v_owners from public.organization_members
    where organization_id = p_org and role = 'owner';
    if v_owners <= 1 then
      return jsonb_build_object('ok', false, 'error', 'last_owner');
    end if;
  end if;

  lock table public.organization_members in share row exclusive mode;

  delete from public.organization_members
  where organization_id = p_org and user_id = p_actor;

  insert into public.organization_audit_logs
    (actor_user_id, organization_id, action, target_user_id, before_role, after_role)
  values (p_actor, p_org, 'member.leave', p_actor, v_actor_role, null);

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.transfer_organization_ownership(
  p_org uuid,
  p_target uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_owners integer;
begin
  if p_org is null or p_target is null or p_actor is null then
    raise exception 'Invalid member parameters' using errcode = 'P0001';
  end if;
  if p_target = p_actor then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  perform 1 from public.organizations where id = p_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select role into v_actor_role from public.organization_members
  where organization_id = p_org and user_id = p_actor;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  -- Only a current owner may transfer. Membership role is the live signal;
  -- owner_id is healed to the target below (also repairs historical drift).
  if v_actor_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  -- Target must belong to the SAME organization (cross-org transfer is
  -- rejected as not_found without leaking the other org's membership).
  select role into v_target_role from public.organization_members
  where organization_id = p_org and user_id = p_target;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  lock table public.organization_members in share row exclusive mode;

  -- Atomic: canonical owner_id, demote previous owner, promote target.
  -- Order matters: promote the target FIRST so the last-owner trigger never
  -- observes an intermediate zero-owner state within this transaction.
  update public.organizations set owner_id = p_target where id = p_org;
  update public.organization_members set role = 'owner'
  where organization_id = p_org and user_id = p_target;
  update public.organization_members set role = 'admin'
  where organization_id = p_org and user_id = p_actor;

  select count(*) into v_owners from public.organization_members
  where organization_id = p_org and role = 'owner';
  if v_owners <> 1 then
    raise exception 'ownership transfer must leave exactly one owner' using errcode = 'P0001';
  end if;

  insert into public.organization_audit_logs
    (actor_user_id, organization_id, action, target_user_id, before_role, after_role)
  values (p_actor, p_org, 'organization.transfer_ownership', p_target, v_target_role, 'owner');

  return jsonb_build_object('ok', true, 'idempotent', false);
exception
  when others then
    raise;
end;
$$;

-- Only service_role may execute (same precedent as billing RPCs).
revoke all on function public.add_organization_member(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.add_organization_member(uuid, uuid, text, uuid) to service_role;
revoke all on function public.remove_organization_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_organization_member(uuid, uuid, uuid) to service_role;
revoke all on function public.change_member_role(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.change_member_role(uuid, uuid, text, uuid) to service_role;
revoke all on function public.leave_organization(uuid, uuid) from public, anon, authenticated;
grant execute on function public.leave_organization(uuid, uuid) to service_role;
revoke all on function public.transfer_organization_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid, uuid) to service_role;

comment on function public.transfer_organization_ownership(uuid, uuid, uuid) is 'Atomic ownership transfer: owner_id + member roles update together with exactly-one-owner verification. Actor auth (must be current owner) is enforced inside the transaction.';
