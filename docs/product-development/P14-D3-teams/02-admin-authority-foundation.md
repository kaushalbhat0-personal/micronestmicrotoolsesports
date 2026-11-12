# 02 — Admin Authority Foundation (F-A01 Re-home)

## Dependency analysis

| Object | Source | Consumers |
| --- | --- | --- |
| `platform_admins` | `20261112000001_d1_admin_foundation.sql` | `is_super_admin`, P13 snapshot SQL |
| `is_super_admin()` | Created in `000001` (membership-only) | P11 trust guard, P13 activation policies/triggers |
| Active-status join (F-A01) | Was in archived D1 `000003` | Required fail-closed admin for P11/P13 |

## Remote presence

Not freshly verified this session (Supabase MCP unavailable). Per P13/P14-C2 docs: remote has G1 only — **no** `platform_admins` / `is_super_admin` remotely until admin migrations apply.

## Re-home result

New file: `supabase/migrations/20261112000002_p14_admin_superadmin_active_gate.sql`

- Replaces `is_super_admin()` with `platform_admins ⋈ app_users.status='active'`
- Hardens admin/cron trigger `search_path=''` + revoke execute from anon/authenticated
- Placed **after** D1 admin foundation and **before** P9/P11/P13

Did **not** copy archived D1 teams SQL. Did **not** modify G1 files.
