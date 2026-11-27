# 06 — Technical Blocker Reconciliation (+ runbooks)

## Implemented in D1.6.1 (local, unapplied)

- **F-NEW-01 → FIXED (static):** `000004` insert nullness; replay RT-04b pending.
- **F-T13 → FIXED (static):** six `IF NOT EXISTS` btree indexes in `000004`
  (`team_members(user_id)`, `recruitment_posts(team_id,status)`,
  `applications(post_id)`, `applications(applicant_user_id)`,
  `reports(reporter_user_id)`, `reports(target_type,target_id)`). No behavior/
  RLS change; safe under any product outcome.

## Deferred with rationale (no product assumption made)

- **F-T10 game-key equality:** a trigger would lock D1-D2's exact semantics —
  deferred to the D1-D2 approval with the rule attached.
- **F-T11 owner-row delete guard:** "last captain/leave vs remove" is D1-D10
  semantics — deferred to transfer design.
- **F-T12 org guard:** any CHECK wording constrains D1-D4's future FK —
  deferred to org design.
- **F-A07 cron quality:** additive CHECKs/index safe in principle, but
  `error_summary` gating is workflow semantics — deferred to the replay phase
  with the decision attached.
- **F-A02 helper:** service-role + `requireSuperAdmin` + app secret-scan stands
  (least-privilege, no new API). A DEFINER audit-write API needs its own
  platform-admin decision — not built.
- **FWD-01/FWD-02:** documented in `05`; owned by the future captain/transfer
  migrations.

## Runbooks (procedural, no code)

- **F-A05 first-admin bootstrap:** insert the founding `platform_admins` row via
  the Supabase dashboard (or service-role SQL in an approved session) with a
  `reason ≥5 chars` and `granted_by` of the authorizing identity; verify
  `is_super_admin()` returns true for that user and false for a control user;
  record the action in the owner log. Never expose the service-role key to do it.
- **F-A04 TRUNCATE governance:** row triggers never fire on TRUNCATE (engine).
  API roles are revoked (verified). Owner/service-role TRUNCATE on
  `admin_audit_logs`/`cron_run_ledger` is permitted only as a documented,
  owner-authorized maintenance with pre-export of the table and dual control;
  routine operations must never use it.
