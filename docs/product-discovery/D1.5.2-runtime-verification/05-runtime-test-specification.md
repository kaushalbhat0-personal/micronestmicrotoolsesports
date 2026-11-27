# 05 — Runtime Test Specification (for an approved disposable environment)

Conventions: disposable project only; `run_id`-scoped identities
(`t_<run>_<who>@example.com`, slugs `t-<run>-*`); service role confined to
setup/verification/cleanup; tracked-id cleanup in reverse dependency order;
never truncate/reset. A = active user, S = suspended user, C = captain,
M = ordinary member, O = owner. All PostgREST calls use anon key + caller JWT
unless stated.

## RT-01 — Cross-user team ownership mutation attempt

- Setup: O creates team T (active). Attacker X (active, non-member).
- Op: `X: PATCH /teams?id=T {owner_user_id: X}` and `{name: 'pwned'}`.
- Expected: both denied (RLS default-deny; X matches no USING row).
- Invariant: users cannot modify another user's team.
- Requires: real PG + Auth (two JWTs).

## RT-02 — Captain attempts protected-field change

- Setup: O creates team T; member C promoted to `captain` via privileged path.
- Op: `C: PATCH /teams?id=T {owner_user_id: C}`, `{game_key: 'mlbb'}`,
  `{slug: 'hijack'}`, `{organization_id: 'evil'}`, then `{name: 'ok'}`.
- Expected: all four protected writes denied (grant + trigger); `name` allowed.
- Invariant: F-T01 ownership/identity immutability.
- Requires: real PG (column grants + trigger); Auth.

## RT-03 — Applicant self-acceptance attempt

- Setup: team T + open post P; applicant A applies (status `applied`).
- Op: `A: PATCH /applications?id=A1 {status: 'accepted'}`.
- Expected: denied (policy WITH CHECK + trigger).
- Invariant: F-T02; no self-promotion path.
- Requires: real PG + Auth.

## RT-04 — Applicant decision-metadata forgery

- Setup: as RT-03.
- Op: `A: PATCH /applications?id=A1 {decided_by: <uuid>, decided_at: <now>}`.
- Expected: denied (grant columns + trigger non-null check).
- Invariant: decision provenance unforgeable by applicants.
- Requires: real PG + Auth.

## RT-04b — Insert-time decision forgery (covers F-NEW-01)

- Setup: open post P.
- Op: `A: POST /applications {post_id: P, applicant: A, status: 'applied',
  decided_by: <uuid>, decided_at: <now>}`.
- Expected (current): **allowed** — records F-NEW-01. After forward fix: denied.
- Invariant: creation carries no decision provenance.
- Requires: real PG + Auth.

## RT-05 — Applicant post reassignment

- Setup: posts P1, P2; A applies to P1.
- Op: `A: PATCH /applications?id=A1 {post_id: P2}` then withdraw
  `PATCH {status: 'withdrawn'}`.
- Expected: reassignment denied (grant + trigger); standalone withdraw allowed.
- Invariant: application linkage immutable.
- Requires: real PG + Auth.

## RT-06 — Suspended admin calls `is_super_admin()`

- Setup: admin row for S; flip `app_users.status` to `suspended` (service role).
- Op: `SELECT public.is_super_admin()` as S; also as active admin and as anon.
- Expected: false / true / denied-execute respectively.
- Invariant: F-A01 fail-closed suspended rejection.
- Requires: real PG + Auth (role switching).

## RT-07 — Suspended account team-member writes

- Setup: suspended captain C writes to own team.
- Op: `C: PATCH/DELETE /team_members?...` and recruitment insert.
- Expected: all denied (active guard); reads still allowed.
- Invariant: F-T03 parity with G1 suspended-write posture.
- Requires: real PG + Auth.

## RT-08 — Suspended account recruitment-post writes

- Setup: as RT-07.
- Op: `C: POST/PATCH/DELETE /recruitment_posts ...`.
- Expected: denied on all three; error is generic (no oracle).
- Invariant: F-T03.
- Requires: real PG + Auth.

## RT-09 — Arbitrary membership insertion

- Setup: captain C of team T; victim V (active, never applied).
- Op: `C: POST /team_members {team_id: T, user_id: V, role: 'player'}`;
  also self-join `{user_id: C}` on a foreign team.
- Expected: denied (no policy + no grant).
- Invariant: F-T04; no consent invented.
- Requires: real PG + Auth.

## RT-10 — Anonymous base-table access

- Setup: public team T with posts; private team U.
- Op: anon `GET /teams`, `/team_members`, `/recruitment_posts`, `/applications`,
  `/reports` (select + write attempts).
- Expected: all denied/empty via RLS+grants.
- Invariant: RPC-only public boundary.
- Requires: real PG + PostgREST anon role.

## RT-11 — Anonymous masked RPC access

- Setup: as RT-10.
- Op: anon `RPC search_teams`, `RPC get_team_by_slug`.
- Expected: public rows only, masked columns (no owner/created/org), bounded
  counts; no applicant/member PII.
- Invariant: D1-D12 masked discovery.
- Requires: real PG + PostgREST anon role.

## RT-12 — Direct RPC with forged identity parameters

- Setup: attempt `search_teams` with injected `p_*` identity-like args and
  oversized/negative pagination.
- Expected: no identity parameter exists (auth.uid-only internals); limit
  clamped 1..60, offset 0..1000; no error-oracle on invalid enums.
- Invariant: caller-controlled identity impossible.
- Requires: real PG.

## RT-13 — Search wildcard and escape behavior

- Setup: team named `100%_x` (service role) + ordinary `alpha-esports`.
- Op: `search_teams(p_query: '%')`, `'_'`, `'\\'`, `'100%_x'`, `'ALPHA'`,
  200-char input, `' OR '1'='1`.
- Expected: wildcards match literally (only `100%_x` for its literal query);
  case-insensitive ordinary match; 120-char cap; injection inert (parameterized).
- Invariant: F-T06 G1 parity.
- Requires: real PG.

## RT-14 — Duplicate application race

- Setup: open post P; applicant A.
- Op: two concurrent `POST /applications {P, A}` (parallel clients).
- Expected: exactly one `applied` row (partial unique); second gets
  conflict/unique-violation, no duplicate actives.
- Invariant: anti-double-apply race safety.
- Requires: real PG + concurrency (parallel requests).

## RT-15 — Audit log mutation and deletion

- Setup: audit row (service role).
- Op: authenticated `PATCH/DELETE /admin_audit_logs`; service-role DML
  `UPDATE/DELETE` attempt.
- Expected: denied for API roles (no policy); service-role DML rejected by
  trigger (`append-only`).
- Invariant: F-A04 DML boundary.
- Requires: real PG (trigger) + Auth; service-role step for the second half.

## RT-16 — Audit TRUNCATE privileges

- Setup: as RT-15.
- Op: `TRUNCATE admin_audit_logs` as authenticated (and anon).
- Expected: denied (explicit revoke). Owner/service-role TRUNCATE documented
  as engine-possible → procedural control, not tested destructively.
- Invariant: least-privilege clarity; no destructive execution.
- Requires: real PG. No data destruction: revokes make the API-role attempts
  fail before any effect.

## RT-17 — Cron ledger unauthorized transitions

- Setup: ledger row in `running` (service role).
- Op: authenticated INSERT `succeeded` directly; UPDATE `running→running`;
  UPDATE id columns; UPDATE without `completed_at`; DELETE.
- Expected: each denied (no policy for API roles; triggers would reject
  regardless); service-role lifecycle tested separately per trigger matrix.
- Invariant: F-A06/F-A07 lifecycle enforcement.
- Requires: real PG + Auth.

## RT-18 — G1 public player RPC and 12-column regression

- Setup: consented visible profile + game profile (existing G1 fixtures).
- Op: anon `RPC search_player_directory` / `get_player_by_handle`.
- Expected: exact frozen 12 columns in order, `game_user_id` absent, consent +
  active predicates, `ILIKE` escaping, limit 1..48.
- Invariant: G1 frozen projection untouched by D1 sequence.
- Requires: real PG + PostgREST anon role.
