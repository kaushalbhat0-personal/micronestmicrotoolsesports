# 04 — RLS and Grants Matrix

Conventions: `auth.uid()` only; no user-ID parameters anywhere. `anon` = anonymous
PostgREST role; `authenticated` = signed-in. Service-role bypasses RLS (by design;
not listed as a policy path).

## 1. Admin migration (`20261112000001`)

| Table / function | anon | authenticated select | insert | update | delete | Notes |
|---|---|---|---|---|---|---|
| `platform_admins` | none | none (definer/app) | none (service-role) | none | none | Revoke-all (133–135); `is_super_admin()` gate only |
| `admin_audit_logs` | none | none (service-role) | none (service-role) | never (trigger 57–59) | never (trigger) | Revoke-all (136–138); TRUNCATE bypass F-A04 |
| `cron_run_ledger` | none | none (service-role) | running-only (trigger 81–84) | running→terminal only (90–96) | never (trigger 116) | Revoke-all (139–141); TRUNCATE bypass F-A04 |
| `is_super_admin()` | no execute | execute | — | — | — | Revoke-public + grant-authenticated (143–144) |

No policy in this file references `is_super_admin()` — reads/writes are
service-role-only after app auth. Comment claiming DEFINER writes (4–6) is
inaccurate (F-A03).

## 2. Teams migration (`20261112000002`)

| Table / function | anon | authenticated select | insert | update | delete | Notes |
|---|---|---|---|---|---|---|
| `teams` | none (RPC only) | owner/creator/member (222–223) | owner=self+active (225–230) | captain+active (232–241) **overbroad columns F-T01** | no policy → denied (grant exists 317 but inert) | Grants select/insert/update/delete (317); truncate/refs/trigger revoked (318) |
| `team_members` | none | member-team OR self (245–246) | captain (248–250) **no active F-T03; any user_id F-T04** | captain (252–255) **no active** | captain (257–259) **no active** | Grants select/insert/update/delete (322) |
| `recruitment_posts` | none (RPC future) | owner/creator/member-team (263–267) | captain+self (269–271) **no active** | captain (273–276) **no active** | captain (278–280) **no active** | Grants select/insert/update/delete (327) |
| `applications` | none | applicant OR post-captain (284–290) | applicant=self+applied+active (292–298) | applicant-only (300–303) **overbroad F-T02; no captain path** | none (grant omits delete 332–333) | Grants select/insert/update (332) |
| `reports` | none | none (admin only) | reporter=self+open+active (306–312) | none | none | Grant insert-only (337–338) |
| `is_team_member/captain` | no execute | execute | — | — | — | Revoke-public + grant-authenticated (340–343) |
| `search_teams` | execute | execute | — | — | — | Masked, `is_public` + limit 1–60 (344–345); LIKE F-T06 |
| `get_team_by_slug` | execute | execute | — | — | — | Masked, `is_public` + limit 1 (346–347) |

## 3. Bypass analysis

- **Anon base-table bypass:** none. All base tables revoke anon + no anon policy.
  Anon public access is RPC-only (`search_teams`, `get_team_by_slug`), which
  enforce `is_public` + column masking. PROVED by grant + policy read.
- **Authenticated non-member bypass of masked RPCs:** denied. Non-member SELECT
  on `teams/members/posts/applications` fails RLS; reports have no select policy.
  Member/captain base reads expose internals (`owner_user_id`, roster `user_id`,
  applicant notes) — intended collaboration surface, requires privacy sign-off
  (F-T08), not a bypass.
- **Suspended-account bypass:** present (F-T03, F-A01). `teams`/`applications`/
  `reports` check `app_users.status='active'`; `team_members`/`recruitment_posts`
  and `is_super_admin()` do not.
- **Column-escalation bypass:** present (F-T01, F-T02). Grants are table-wide;
  policies do not restrict columns, so PostgREST UPDATE reaches
  `owner_user_id/game_key/slug` and `status/decided_by/post_id`.
- **Wildcard-enumeration bypass:** present (F-T06). Unescaped `ILIKE` pattern
  lets `%`/`_` widen team search beyond literal intent.
- **Org-confusion bypass:** absent. `organization_id` appears in no USING/WITH
  CHECK expression (verified by full-file read).
- **Identity-spoof bypass:** absent. No policy or function accepts a user-id
  argument; all bindings are `auth.uid()` (+ `created_by=self` on insert).

## 4. Least-privilege deltas vs G1 posture

G1 pattern (frozen): revoke-all public/anon → grant minimum to authenticated;
column-level UPDATE after G1-7 (`player_profiles` generic patch only);
`search_path=''` on every function; trigger-function revokes.
D1 gaps: table-wide UPDATE grants without column lists (F-T01/F-T02);
trigger functions without `search_path`/revokes (F-A06); unbounded `text[]`
(F-T09); unescaped LIKE (F-T06). Corrections in `06` restore G1 parity.
