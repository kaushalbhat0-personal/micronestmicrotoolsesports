-- P11 F-01: database-enforced organizer trust_state protection.
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely. Additive only: no G1–P9
-- table, function, policy, grant, or storage object is modified. This file
-- only ADDS one trigger function, one trigger, and function-level revokes.
--
-- Problem (P10 F-01): the P9 `organizers admin update` policy plus the
-- table-level UPDATE grant permit any owner/admin row-holder to write ANY
-- column, including `trust_state`, through direct SQL/PostgREST. Verification
-- separation rested on the application boundary alone.
--
-- Fix: a BEFORE INSERT OR UPDATE trigger that freezes `trust_state` for every
-- caller except an explicitly authorized moderator. Moderator authority is
-- `public.is_super_admin()` (D1, hardened in D1.5.1: platform_admins
-- membership AND active app_users row, fail-closed for missing/suspended/anon
-- callers). When no moderator authority exists (empty platform_admins, or the
-- authority decision unapproved), the trigger blocks EVERYONE — fail-closed.
--
-- What this does NOT do:
--   - No service-role shortcut: the function is SECURITY INVOKER and checks
--     the caller's own authority; it grants nothing.
--   - No reviewer-identity or timestamp columns are added to `organizers`:
--     reviewer identity for verification decisions lives in the moderation
--     queue audit (20261113000003_p11_moderation_queue), never in caller input.
--   - No public-projection change: the masked RPCs read `trust_state` as
--     before; only unprivileged WRITES are blocked.
--   - `is_public` is intentionally NOT frozen here: hiding a listing is the
--     fail-safe direction (removes visibility) and unpublish flows need it.
--     A moderator-only visibility rule may tighten this later with approval.
--
-- Rollback: `drop trigger trg_organizers_trust_guard on public.organizers;`
-- followed by `drop function public.prevent_unprivileged_trust_change();`
-- Restores the P9 posture exactly (application-boundary enforcement only).

create or replace function public.prevent_unprivileged_trust_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT') then
    -- New organizers always start unverified. No caller — member or moderator —
    -- may mint a pre-confirmed row; confirmation is a reviewed transition.
    if (NEW.trust_state is distinct from 'not_submitted') then
      raise exception 'organizers must be created with trust_state not_submitted';
    end if;
    return NEW;
  end if;
  -- TG_OP = 'UPDATE': any trust_state change requires moderator authority.
  -- Self-confirmation through direct SQL/PostgREST raises here even though the
  -- RLS policy and table grant would otherwise permit the row update.
  if (NEW.trust_state is distinct from OLD.trust_state) then
    if (not public.is_super_admin()) then
      raise exception 'organizers.trust_state changes require moderator authority';
    end if;
  end if;
  return NEW;
end;
$$;

comment on function public.prevent_unprivileged_trust_change() is
  'P11 F-01: trust_state is moderator-only (is_super_admin). Fail-closed: blocks everyone when no moderator authority exists.';

create trigger trg_organizers_trust_guard
before insert or update on public.organizers
for each row execute function public.prevent_unprivileged_trust_change();

-- Trigger functions must not be directly callable by API roles.
revoke all on function public.prevent_unprivileged_trust_change() from public;
revoke all on function public.prevent_unprivileged_trust_change() from anon;
revoke all on function public.prevent_unprivileged_trust_change() from authenticated;
