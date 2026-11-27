-- P15-M2B.4: fix admin_audit_logs.action check regex.
-- Live constraint was double-escaped to require a literal backslash before the
-- dot (only 'domain\.action' passed). Intended pattern is domain.action with a
-- literal dot. Dollar-quote to avoid escape ambiguity.
-- Esports knniommcyyhbyiwljisk only.

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_action_check;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_action_check
  check (action ~ $re$^[a-z_]+\.[a-z_]+$$re$);
