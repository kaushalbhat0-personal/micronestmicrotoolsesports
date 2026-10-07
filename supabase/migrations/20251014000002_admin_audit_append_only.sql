-- Audit append-only hardening (RCCF-ADMIN-10A)
-- Admin audit logs must be append-only: INSERT allowed via trusted path, UPDATE/DELETE prohibited.
-- RLS alone cannot enforce this for service_role (bypasses RLS), so we add database-level triggers.
-- These triggers run for all roles including service_role, preventing accidental mutation of history.

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_logs is append-only: % not allowed (id=%)', TG_OP, coalesce(old.id::text, new.id::text);
  return null;
end;
$$;

drop trigger if exists admin_audit_logs_no_update on public.admin_audit_logs;
create trigger admin_audit_logs_no_update
  before update on public.admin_audit_logs
  for each row execute function public.prevent_admin_audit_mutation();

drop trigger if exists admin_audit_logs_no_delete on public.admin_audit_logs;
create trigger admin_audit_logs_no_delete
  before delete on public.admin_audit_logs
  for each row execute function public.prevent_admin_audit_mutation();

comment on function public.prevent_admin_audit_mutation() is 'Enforces append-only audit: blocks UPDATE/DELETE on admin_audit_logs for all roles including service_role. INSERT remains allowed via recordAdminAudit().';
