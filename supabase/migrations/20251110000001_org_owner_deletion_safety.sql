-- MicroNest — Last-owner/deletion safety + transfer semantics (RCCF-ORG-MEMBERS-02)
-- Follow-up to 20251109000001_org_members_hardening.sql. Apply AFTER re-applying
-- that file (this migration supersedes its trigger design and its
-- transfer_organization_ownership self-transfer branch; everything else there
-- stands unchanged).
-- DO NOT APPLY AUTOMATICALLY — user applies manually.
--
-- Problem 1 (audit A2-02, P2): protect_last_organization_owner() is a BEFORE
-- row trigger, so a legitimate DELETE FROM organizations cascades into
-- organization_members and the trigger aborts the cascade as if the final
-- owner were being removed. Organization deletion is broken for every role,
-- including service_role.
--
-- Problem 2 (audit A2-03, P3): transfer_organization_ownership() answers
-- {ok:true, idempotent:true} for self-transfer even when the actor is not
-- an owner — harmless (no mutation, no audit row) but misleading.
--
-- Design (auditor-recommended, PostgreSQL-safe):
--   §1 Replace the immediate check trigger with two cooperating triggers:
--      - BEFORE UPDATE OR DELETE: serialize_organization_members() takes
--        LOCK TABLE ... IN SHARE ROW EXCLUSIVE MODE and nothing else.
--        The lock is held to commit, so concurrent member mutations are
--        fully serialized.
--      - CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED:
--        enforce_organization_owner_count() runs at COMMIT time, when the
--        final state is visible: for every organization touched that STILL
--        EXISTS, at least one owner row must remain. A deleted parent (org
--        gone via cascade) is skipped — there is nothing to protect.
--      Race argument: the lock serializes mutations; each transaction's
--      commit-time check observes all previously committed state, so two
--      simultaneous demotions/leaves can never both commit a surviving
--      organization with zero owners. Direct sole-owner delete/demotion
--      still raises (org alive, count 0 at commit). Full member wipes of a
--      living org still raise. Legitimate org deletion commits cleanly.
--   §2 Redefine transfer_organization_ownership() byte-identical to
--      20251109000001 except: the actor-owner check runs BEFORE the
--      self-transfer shortcut, so non-owner self-transfer returns
--      {ok:false,error:'forbidden'} while a genuine owner self-transfer
--      keeps its idempotent success. Promote-target-first ordering and the
--      exactly-one-owner verification are unchanged.
--
-- No other schema, RLS, pricing, entitlement, or policy change.

-- ─────────────────────────────────────────────────────────────
-- §1 deletion-safe last-owner enforcement
-- ─────────────────────────────────────────────────────────────
-- Retire the BEFORE-check design (kept in history, superseded here).
drop trigger if exists organization_members_last_owner on public.organization_members;
drop function if exists public.protect_last_organization_owner();

-- Serialization only: held to commit, orders all member mutations.
create or replace function public.serialize_organization_members()
returns trigger
language plpgsql
as $$
begin
  lock table public.organization_members in share row exclusive mode;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists organization_members_serialize on public.organization_members;
create trigger organization_members_serialize
  before update or delete on public.organization_members
  for each row execute function public.serialize_organization_members();

-- Commit-time invariant: every SURVIVING touched organization keeps an owner.
create or replace function public.enforce_organization_owner_count()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_owners integer;
  v_alive boolean;
begin
  -- An UPDATE may move a row between orgs: check both sides. (Member rows
  -- never change org through the RPCs; this covers direct API writes.)
  for v_org in
    select distinct org_id from (values (OLD.organization_id), (NEW.organization_id)) as t(org_id)
    where org_id is not null
  loop
    -- Parent deleted (cascade completed): nothing to protect.
    select exists (select 1 from public.organizations where id = v_org) into v_alive;
    if v_alive then
      select count(*) into v_owners from public.organization_members
      where organization_id = v_org and role = 'owner';
      if v_owners < 1 then
        raise exception 'organization must retain at least one owner' using errcode = 'P0001';
      end if;
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists organization_members_owner_count on public.organization_members;
-- CONSTRAINT TRIGGER so the check defers to commit: it observes final state
-- (own uncommitted writes plus all previously committed concurrent work,
-- which the §1 serialization lock orders ahead of this transaction).
create constraint trigger organization_members_owner_count
  after update or delete on public.organization_members
  deferrable initially deferred
  for each row execute function public.enforce_organization_owner_count();

comment on function public.serialize_organization_members() is 'Serialization half of last-owner enforcement: table lock held to commit so concurrent member mutations cannot interleave. The invariant itself is checked at commit by enforce_organization_owner_count.';
comment on function public.enforce_organization_owner_count() is 'Commit-time last-owner invariant: raises when a surviving organization would commit with zero owners. Skips organizations deleted in the same transaction (cascade), so legitimate org deletion works.';

-- ─────────────────────────────────────────────────────────────
-- §2 transfer self-transfer semantics (non-owner self → forbidden)
-- ─────────────────────────────────────────────────────────────
-- Identical to 20251109000001 except the actor-owner verification now
-- precedes the self-transfer shortcut. Owner self-transfer keeps its
-- idempotent success; nothing else changes (promote-first, count check,
-- audit, grants).
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
  perform 1 from public.organizations where id = p_org;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select role into v_actor_role from public.organization_members
  where organization_id = p_org and user_id = p_actor;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;
  -- Only a current owner may transfer — including the self-transfer case,
  -- so a non-owner self-call reports forbidden instead of a success.
  if v_actor_role is distinct from 'owner' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  -- Genuine owner self-transfer stays an idempotent no-op (no writes, no audit).
  if p_target = p_actor then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  -- Target must belong to the SAME organization (cross-org transfer is
  -- rejected as not_found without leaking the other org's membership).
  select role into v_target_role from public.organization_members
  where organization_id = p_org and user_id = p_target;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  lock table public.organization_members in share row exclusive mode;

  -- Atomic: canonical owner_id, promote target FIRST (so no intermediate
  -- zero-owner state), then demote previous owner.
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

revoke all on function public.transfer_organization_ownership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid, uuid) to service_role;
