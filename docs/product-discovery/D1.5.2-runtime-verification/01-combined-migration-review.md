# 01 — Combined Migration Review (000001 + 000002 + 000003)

Method: full-text read of all three files. Comments treated as claims, never as
evidence. Every verdict below cites the enforcing statement.

## F-T01 — Protected team fields (was Critical) → CLOSED at SQL-text level

- M3 §D revokes table-wide UPDATE then grants exactly
  `(name, description, current_level, target_level, recruiting, is_public,
  region_code, updated_at)` (`000003:168-170`). The five protected columns
  (`owner_user_id, created_by, game_key, slug, organization_id`) plus
  `id/created_at` appear nowhere in the grant list — verified by line read.
- `enforce_teams_immutable_columns()` (`000003:140-166`) rejects any UPDATE that
  changes those seven columns (`IS DISTINCT FROM`, null-safe for
  `organization_id`). Second layer independent of grants.
- `updated_at` is granted because `handle_updated_at()` is `SECURITY INVOKER`
  (runs as caller) — same pattern as G1-7 column grants. Correct, not a hole:
  the immutable trigger does not constrain `updated_at`.
- No transfer RPC introduced (verified: no `transfer` identifier in M3).
- Interaction with RLS: row gate (`teams captain update`, unchanged) still decides
  *which* rows; grants + trigger decide *which columns*. Both must allow.
- **New-behavior check:** captain UPDATE of allowed columns still works;
  owner/creator rows are equally constrained (no owner-vs-captain assumption).

## F-T02 — Withdraw-only applications (was Critical) → CLOSED at SQL-text level

- Policy recreated with transition window (`000003:175-186`):
  USING `applicant=self AND status IN (applied, shortlisted)`,
  WITH CHECK `applicant=self AND status='withdrawn' AND decided_* IS NULL`.
- Grants narrowed to `(status, updated_at)` (`000003:188-189`): `post_id`,
  `applicant_user_id`, `note`, `decided_*`, `created_at` unwritable via PostgREST.
- `enforce_application_withdraw_boundary()` (`000003:191-222`) independently
  rejects reassignment, non-null `decided_*`, out-of-window transitions, and
  note/created_at mutation.
- No captain decision path added (verified: no `decide/accept_application`).
- **Gap (new finding F-NEW-01, Medium):** INSERT-time `decided_by/decided_at`
  forgery remains possible — see below. The UPDATE boundary itself is complete.

## F-NEW-01 — Application INSERT permits decision-metadata forgery (new, Medium)

- **Where:** M2 insert policy (`000002:292-298`) constrains only
  `applicant=self + status='applied' + active`; `decided_by/decided_at`
  unconstrained. Table CHECK only requires both-null or both-set
  (`000002:83`), so an applicant can INSERT with `decided_by=<any>,
  decided_at=<now>` on a row whose status is `applied`.
- **Why Medium, not Critical:** status is still forced to `applied`; the forged
  metadata is inconsistent (decision fields set on a non-decided row) rather
  than a status escalation. It misleads captain reads, not authorization.
- **Why not patched here:** phase constraint — stop and report before changing
  migrations; a non-critical defect is documented, not silently fixed.
- **Recommended fix (forward):** add `AND decided_by IS NULL AND decided_at IS
  NULL` to the insert WITH CHECK and/or extend the boundary trigger to
  `BEFORE INSERT`. One line each; replay spec RT-04b covers it.

## F-A01 — Active administrator check (was High) → CLOSED at SQL-text level

- `is_super_admin()` (`000003:30-44`) joins `platform_admins → app_users` with
  `au.status='active'`, identity strictly `auth.uid()`. Missing/suspended/anon
  callers yield false. Grants re-asserted (revoke-public, authenticated-only).
- DEFINER bypass of `app_users` RLS inside the join is the intended, narrow
  privilege use (read-only membership + status).

## F-T03 — Active guards (was High) → CLOSED at SQL-text level

- All six policies recreated with the inline `active` EXISTS guard
  (`000003:238-288`): team_members update (USING + WITH CHECK), team_members
  delete (USING), recruitment insert (WITH CHECK incl. preserved
  `created_by=self`), recruitment update (USING + WITH CHECK), recruitment delete
  (USING). Read policies untouched (G1 parity: suspended reads allowed).

## F-T04 — Membership insertion denied (was High) → CLOSED at SQL-text level

- Policy dropped, never recreated (`000003:228` + verified absence of any
  `CREATE POLICY "team_members captain insert"`). `REVOKE INSERT` (`000003:230`)
  removes the M2 table grant. Net: RLS default-deny + no privilege = fail-closed
  for every API role. No invite/consent language introduced.

## F-T06 — LIKE escaping (was Medium) → CLOSED at SQL-text level

- Replacement `search_teams` (`000003:295-366`) implements the G1 chain exactly:
  `btrim → nullif → left(...,120) → backslash→double → %→\%, _→\_ → ILIKE ...
  ESCAPE '\'`. Order correct (backslash first). Offset newly clamped 0..1000
  (G1 parity; behavior change for offset>1000 only, documented).
- Signature, return columns, `is_public` predicate, limit 1..60, and
  anon+authenticated grants preserved. `get_team_by_slug` untouched (equality,
  no wildcards — correct to leave).

## F-A02 / F-A04 — Privilege boundary and TRUNCATE (were Medium) → accurately bounded

- No RLS path and no DEFINER helper created (verified by absence); comments now
  state service-role-only writes, app-layer secret scanning, and the
  DML-only trigger guarantee (`000003:119-134`). Explicit
  `REVOKE TRUNCATE ... FROM anon, authenticated` on all three tables
  (`000003:132-134`) — redundant with M1's revoke-ALL, kept as audit clarity.
- Owner/service-role TRUNCATE remains engine-possible (row triggers never fire
  on TRUNCATE). Documented as a governed-procedure limitation, not a defect.

## F-A03 / F-A06 (were Medium/Low) → CLOSED

- Comments rewritten to the actual boundary; all three admin trigger functions
  recreated with `SECURITY INVOKER + SET search_path=''` and revokes from all
  API roles (`000003:53-117`).

## Forward dependencies discovered (not defects — fail-closed is correct now)

- **FWD-01:** the withdraw trigger rejects non-null `decided_*` for *every*
  updater, including service-role and any future DEFINER captain RPC (triggers
  fire regardless of role). When the captain-decision path is approved, its
  migration must deliberately revise this trigger (e.g. role-aware exemption),
  not bypass it.
- **FWD-02:** same for the teams immutable-columns trigger vs the future
  transfer RPC (D1-D10): transfer cannot be implemented as a plain UPDATE while
  this trigger stands; the approved transfer migration must own the trigger
  revision with old-owner/member/audit checks.
