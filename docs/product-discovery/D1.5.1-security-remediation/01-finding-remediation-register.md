# 01 — Finding Remediation Register

Conventions: `M1` = `20261112000001`, `M2` = `20261112000002`,
`M3` = `20261112000003_d1_security_remediation.sql` (new, local only).
"Static" = SQL-text + unit assertions without a live PostgreSQL; replay = row-level
execution in a disposable database (still required, forbidden in this phase).

## F-T01 — Captain can overwrite team ownership/identity (was Critical) → FIXED (static)

- **Root cause:** M2 table-wide `UPDATE` grant + `teams captain update` policy
  checked only captain + active, binding no columns (`M2:232-241,317-318`).
- **Change (M3 §D):** `REVOKE UPDATE ON teams FROM authenticated` +
  `GRANT UPDATE (name, description, current_level, target_level, recruiting,
  is_public, region_code, updated_at)` + `enforce_teams_immutable_columns()`
  trigger rejecting changes to `id/owner_user_id/created_by/game_key/slug/
  organization_id/created_at`. Existing RLS row gate kept.
- **Test:** `team-security-boundary.test.ts` → "F-T01" blocks (grant line,
  per-column trigger assertions, no-transfer-RPC assertion).
- **Limitation:** static only; replay must attempt protected-column UPDATE as
  member-captain and confirm denial at both grant and trigger layers.
- **Approval still required:** D1-D2 (fixed game), D1-D10 (transfer scope).

## F-T02 — Applicant self-accept/forge/reassign (was Critical) → FIXED (static)

- **Root cause:** M2 withdraw policy bound only `applicant_user_id` (`M2:300-303`)
  with table-wide UPDATE grant (`M2:332`).
- **Change (M3 §E):** policy recreated as `applied|shortlisted → withdrawn` with
  `decided_* IS NULL`; grants narrowed to `(status, updated_at)`;
  `enforce_application_withdraw_boundary()` trigger rejects post/applicant
  reassignment, non-null `decided_*`, out-of-window transitions, and
  note/created_at mutation.
- **Test:** `team-security-boundary.test.ts` → "F-T02" blocks.
- **Limitation:** static only; note edits now require withdraw + reapply until an
  edit flow is approved. Replay must attempt self-accept/forgery/reassign.
- **Approval still required:** recruitment lifecycle + captain decision design.

## F-A01 — Suspended super-admin privileged (was High) → FIXED (static)

- **Root cause:** `is_super_admin()` checked membership only (`M1:18-26`).
- **Change (M3 §A):** function joins `app_users` with `status='active'`;
  missing/suspended/anon callers fail closed. Grants re-asserted.
- **Test:** `admin-boundary.test.ts` → "F-A01" blocks.
- **Limitation:** static only; replay must flip an admin to `suspended` and call.
- **Approval:** none (engineering parity with G1 suspended-write posture).

## F-T03 — Suspended roster/post writes (was High) → FIXED (static)

- **Root cause:** six policies in `M2:248-280` lacked the `active` guard.
- **Change (M3 §G):** all six recreated with
  `exists (... app_users ... status='active')`. Read policies untouched.
- **Test:** "F-T03" blocks (≥6 guard occurrences; selects untouched).
- **Limitation:** static only.
- **Approval:** none.

## F-T04 — Arbitrary membership injection (was High) → FIXED by denial (static)

- **Root cause:** `WITH CHECK (is_team_captain(team_id))` constrained the team,
  not the added user (`M2:248-250`).
- **Change (M3 §F):** `DROP POLICY "team_members captain insert"` (not recreated)
  + `REVOKE INSERT ON team_members FROM authenticated` + table comment marking
  the future-RPC placeholder. No invite/consent model invented.
- **Test:** "F-T04" blocks (drop present, no create, revoke present, no invite language).
- **Limitation:** direct member creation now impossible — including legitimate
  bootstrapping. Roster writes resume only via the future authorized RPC.
- **Approval still required:** invite vs application-accept flow (D1-D3/D1-D12).

## F-T06 — LIKE wildcard enumeration (was Medium) → FIXED (static + pure-unit)

- **Root cause:** `'%' || p_query || '%'` + `ILIKE`, no `ESCAPE` (`M2:177`).
- **Change (M3 §H):** `search_teams` replaced with G1-parity escaping
  (btrim, `left(...,120)`, `\`→`\\`, `%`→`\%`, `_`→`\_`, `ESCAPE '\'`),
  offset clamped 0..1000, same columns/predicate/limit.
- **Test:** escaping vectors (`% _ \ quotes empty ordinary 120-cap`) + SQL
  pattern assertions + column/predicate preservation.
- **Limitation:** static + pure-unit; replay must confirm `%` matches literally.
- **Approval:** none.

## F-A02 — Audit DB-boundary gap (was Medium) → PARTIALLY FIXED

- **Change:** honest comments (service-role-only + app `requireSuperAdmin`,
  secret-scan app-only), explicit TRUNCATE revokes. No DEFINER write helper
  created (new API surface = platform-admin decision, BLOCKED).
- **Test:** no-`record_admin_audit`, no new RLS path, secret-scan unit vectors.
- **Remaining:** DB cannot reject secret-bearing audit rows; procedural control.

## F-A03 — Misleading helper comments (was Medium) → FIXED

- **Change:** table/function comments rewritten to state the actual boundary.
- **Test:** comment-text assertions.

## F-A04 — TRUNCATE bypass (was Medium) → PARTIALLY FIXED

- **Change:** explicit `REVOKE TRUNCATE ... FROM anon, authenticated` on all three
  admin tables + runbook note (owner/service-role truncate is engine-governed).
- **Remaining:** engine limit documented, not eliminated.

## F-A06 — Trigger hardening (was Low) → FIXED

- **Change:** all three admin trigger functions recreated with
  `SECURITY INVOKER` + `SET search_path=''` + revokes from all API roles.
- **Test:** function-name, `search_path`, revoke assertions.

## BLOCKED (no code change in D1.5.1)

F-T05 (captain decisions), F-T07 (lifecycle/expiry), F-T08 (PII visibility),
F-T09 (report retention + availability caps), F-T10 (game_key equality),
F-T11 (last-captain/owner-row protection), F-T12 (org-id guard), F-T13 (indexes),
F-A05 (bootstrap runbook), F-A07 (cron data quality). See `07`.
