# 01 — Function Permission Inventory (P14-D5)

Project: `knniommcyyhbyiwljisk` / `micronestmicrotoolsesports` / `ap-northeast-1`.

## Before hardening

| Function (exact args) | Owner | Security | search_path | PUBLIC | anon | authenticated | service_role | Intended |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `search_teams(text,text,text,integer,integer)` | postgres | DEFINER | `''` | false | **true** | true | true | Public RPC |
| `get_team_by_slug(text)` | postgres | DEFINER | `''` | false | **true** | true | true | Public RPC |
| `create_team(text×6,text,boolean,boolean)` | postgres | DEFINER | `''` | false | **true** | true | true | Mutation RPC |
| `update_team_settings(uuid,text×4,text,boolean,boolean)` | postgres | DEFINER | `''` | false | **true** | true | true | Mutation RPC |
| `is_team_owner(uuid)` | postgres | DEFINER | `''` | false | **true** | true | true | RLS helper |
| `is_team_active_member(uuid)` | postgres | DEFINER | `''` | false | **true** | true | true | RLS helper |
| `is_team_captain(uuid)` | postgres | DEFINER | `''` | false | **true** | true | true | RLS helper |
| `is_super_admin()` | postgres | DEFINER | `''` | false | **true** | true | true | Admin RLS helper |
| `enforce_teams_immutable_columns()` | postgres | INVOKER | `''` | false | false | false | true | Trigger |
| `prevent_team_audit_mutation()` | postgres | INVOKER | `''` | false | false | false | true | Trigger |

## Root cause

`pg_default_acl` for roles `postgres` and `supabase_admin` in schema `public` auto-granted `EXECUTE` on new functions to `anon`, `authenticated`, and `service_role`. `REVOKE FROM PUBLIC` does not remove the explicit `anon` ACE.
