-- Draft & Ban — Organization logo storage hardening
--
-- Gap closed: the original org-logos write policies checked only bucket_id,
-- so any authenticated user could write into another organization's folder
-- when the target path was known or guessed. UUID paths made this harder but
-- path secrecy is not authorization.
--
-- After this migration, every write (insert/update/delete) on org-logos must
-- satisfy: object path starts with {organization_id}/ AND the caller is an
-- owner/admin of that organization (existing is_org_admin helper: owner or
-- admin role). Public read is unchanged so finalized share pages keep rendering.
--
-- Path convention (unchanged): {organization_id}/logo.{png,jpg,webp}
-- Additive, deterministic, no secrets, re-runnable.

-- ─────────────────────────────────────────────────────────────
-- Helper: can the caller manage the logo at this storage path?
-- ─────────────────────────────────────────────────────────────
create or replace function public.can_manage_org_logo(object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  first_segment text := split_part(object_name, '/', 1);
begin
  -- Path must start with a well-formed organization UUID. Anything else
  -- (missing segment, malformed id) is denied without touching auth state.
  if first_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  -- Owner/admin of that organization only (matches application rule:
  -- plain members cannot upload or remove the organization logo).
  return public.is_org_admin(first_segment::uuid);
end;
$$;

revoke all on function public.can_manage_org_logo(text) from public;
grant execute on function public.can_manage_org_logo(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Replace bucket-only write policies with folder-scoped policies.
-- Public read is intentionally untouched.
-- ─────────────────────────────────────────────────────────────
drop policy if exists org_logos_admin_write on storage.objects;
create policy org_logos_owner_folder_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and public.can_manage_org_logo(name)
  );

drop policy if exists org_logos_admin_update on storage.objects;
create policy org_logos_owner_folder_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-logos'
    and public.can_manage_org_logo(name)
  )
  with check (
    bucket_id = 'org-logos'
    and public.can_manage_org_logo(name)
  );

drop policy if exists org_logos_admin_delete on storage.objects;
create policy org_logos_owner_folder_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and public.can_manage_org_logo(name)
  );
