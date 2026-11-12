# 06 — Security & RLS Review (GATE D1.5)

## Posture

G1 invariants preserved: session-derived identity (`client.auth.getUser()`), no user-ID args, middleware never bootstraps, RPC-only public reads, frozen 12-col player projection, `noindex` on product surfaces, no service-role in `src/`. Verified by G1 regression (308 tests green).

## New attack surface (D1)

- **Roster pure:** none. No DB/auth/network. Contact column parsed but excluded from identity/outputs. CSV injection neutralized (`escapeCsvCell`). DoS bounded by caps (50k/2000/200/2000/300ch). Deterministic (no randomness/time).
- **Catalog:** pure lookup. Unknown titles → `undefined` (fail-closed). No auth/DB.
- **Admin/audit:** pure validators only in D1. DB pending: default-deny, `is_super_admin()` gate, append-only triggers, secret-scan at app layer, safe projection caps. Risks: none in code; migration requires super-admin + service-role discipline review before apply.
- **Teams domain:** pure + zod. `regionCode` vocabulary-checked (no free-text injection). Slug regex + length bounded. No DB in code.
- **DB design (pending):** owner/captain RLS via `auth.uid()` + `is_team_member/captain()`; active-account guards; anon base-table deny; RPC-only masked discovery (`search_teams`, `get_team_by_slug`, limit ≤60, `p_offset≥0`); partial-unique anti-double-apply; reports insert-only. Risks to clear before apply: `is_team_captain()` dual authority (owner/creator/member-captain) must stay in sync with app checks; `organization_id` free text until FK lands (no auth decisions on it); `availability_required text[]` unbounded elements (cap in server op); `LIKE '%q%'` escaping (`%_` neutralized in server op, not in SQL alone).

## RLS matrix (pending migration)

| Table | anon | authenticated select | insert | update | delete |
|---|---|---|---|---|---|
| teams | none (RPC) | owner/creator/member | owner=auth.uid (active) | captain (active) | captain (via policy; app confirms transfer) |
| team_members | none | member or self | captain | captain | captain |
| recruitment_posts | none (RPC future) | owner/captain/member-team | captain + created_by=self | captain | captain |
| applications | none | applicant or post-captain | applicant=self, status=applied (active) | applicant withdraw (app constrains) | none |
| reports | none | none (admin) | reporter=self, status=open (active) | none | none |
| platform_admins | none | none (definer) | none (definer/RPC) | none | none (RPC atomic) |
| admin_audit_logs | none | none (definer) | definer only | never (trigger) | never (trigger) |
| cron_run_ledger | none | none (definer) | running-only (trigger) | running→terminal (trigger) | never (trigger) |

## Grants

Revoke-all anon/public; least-privilege authenticated per matrix; `is_team_member/captain` + read RPCs to `anon,authenticated` as specified; `is_super_admin` to authenticated; no `TRUNCATE/REFERENCES/TRIGGER` to authenticated.

## What must be redesigned before apply

Nothing in logic; process gates in `09`: security sign-off on dual captain authority, `availability_required` element cap, `LIKE` escaping in server op, `organization_id` non-authoritative note, report retention vs `CASCADE`, owner-account `RESTRICT` transfer flow.

## Bypass protection

No public base-table SELECT for discovery; RPCs enforce `is_public` + bounds; generic errors (no enumeration); 404-equivalence to be enforced in future route layer (not in D1 pure code).
