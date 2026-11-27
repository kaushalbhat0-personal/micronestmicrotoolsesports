# 06 — Findings and Required Fixes

Severity: Critical = remotely exploitable privilege escalation / forgery by an
authenticated user via PostgREST. High = privilege persistence or protected-path
bypass for suspended/fabricated identities. Medium = enumeration, evidence-loss,
defense-in-depth, doc-overstatement. Low = hardening, data quality, indexes.

All line references are to the local migration files. SQL snippets below are
**proposed corrections for review** — they were not applied in D1.5.

---

## Critical

### F-T01 — Teams UPDATE permits ownership / game / slug takeover
- **Where:** `20261112000002:232-241` (policy `teams captain update`) +
  grants `20261112000002:317-318` (table-wide UPDATE).
- **Defect:** USING/WITH CHECK only verify `is_team_captain(id)` + active.
  Any member with `role='captain'` can `UPDATE teams SET owner_user_id=<self>,
  game_key=..., slug=..., created_by=..., organization_id=...` via PostgREST,
  violating D1-D2 (fixed game) and D1-D10 (transfer-first).
- **Fix (smallest safe):** replace table-wide UPDATE with column-level grants +
  keep full-row RLS for the allowed columns; move ownership transfer to a
  dedicated RPC (next phase). Documented change:
  ```sql
  revoke update on table public.teams from authenticated;
  grant update (name, description, current_level, target_level, recruiting,
    is_public, region_code, updated_at)
    on table public.teams to authenticated;
  -- owner_user_id / created_by / game_key / slug / organization_id become
  -- unwritable via PostgREST. Ownership transfer lands as a dedicated
  -- DEFINER RPC with old-owner + active-member + audit checks (requires D1-D10).
  ```
  Alternative (if column grants conflict with tooling): keep grant + add
  `BEFORE UPDATE` trigger rejecting changes to the five frozen columns.
- **Depends on product decision:** yes (D1-D2 fixed-game + D1-D10 transfer scope).
  Document first; apply after owner approval.

### F-T02 — Applicant can self-accept / forge decisions
- **Where:** `20261112000002:300-303` (policy `applications applicant withdraw`) +
  grants `20261112000002:332` (table-wide UPDATE).
- **Defect:** USING/WITH CHECK bind only `applicant_user_id = auth.uid()`.
  Applicant can set `status='accepted'`, `decided_by`, `decided_at`, or reassign
  `post_id` via PostgREST. No captain decision policy exists, so the intended
  "captain decides" flow is unenforced at the DB boundary.
- **Fix (smallest safe):** narrow applicant UPDATE to withdraw-only + immutable
  linkage; add captain decision path as DEFINER RPC (not a broad policy):
  ```sql
  -- tighten applicant policy: withdraw-only, linkage immutable
  drop policy if exists "applications applicant withdraw" on public.applications;
  create policy "applications applicant withdraw"
  on public.applications for update to authenticated
  using (applicant_user_id = auth.uid()
    and status in ('applied','shortlisted'))
  with check (applicant_user_id = auth.uid()
    and status = 'withdrawn'
    and decided_by is null and decided_at is null);
  -- + BEFORE UPDATE trigger: reject post_id/applicant/decided_* changes by applicant
  -- + captain accept/shortlist/decline via DEFINER RPC checking is_team_captain()
  --   + active applicant + audit (requires recruitment-lifecycle decision).
  revoke update on table public.applications from authenticated;
  grant update (status, updated_at) on table public.applications to authenticated;
  ```
- **Depends on product decision:** yes (recruitment lifecycle + decision permissions).
  Document first; apply after owner approval.

## High

### F-T03 — Suspended accounts retain roster/post write paths
- **Where:** `20261112000002:248-280` (`team_members` insert/update/delete,
  `recruitment_posts` insert/update/delete) — no `app_users.status='active'` check,
  unlike `teams` (229,237,240), `applications` (297), `reports` (311).
- **Fix:** add the standard inline guard to each USING/WITH CHECK:
  ```sql
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
  ```
  (6 policies). No product decision required — engineering parity fix.

### F-T04 — Captain can fabricate membership for arbitrary users
- **Where:** `20261112000002:248-250` (`team_members captain insert`).
- **Defect:** `WITH CHECK (is_team_captain(team_id))` constrains the team but not
  the added `user_id` (any UUID, incl. suspended/never-consented users; no
  application linkage, no invite acceptance).
- **Fix options (owner chooses):** (a) app-layer invite-accept with token +
  DB check that inserted `user_id` holds an accepted application (trigger);
  (b) restrict insert to `user_id = auth.uid()` (self-join only) until invites
  designed; (c) DEFINER `accept_application()` RPC that inserts the roster row
  atomically. Minimum DB guard regardless: require added user active:
  ```sql
  and exists (select 1 from public.app_users where id = NEW.user_id and status = 'active')
  -- (as trigger; RLS WITH CHECK cannot reference NEW)
  ```
- **Depends on product decision:** yes (invite vs application-accept flow).

### F-A01 — Suspended super-admin retains `is_super_admin()`
- **Where:** `20261112000001:18-26` (no `app_users` join).
- **Fix:**
  ```sql
  select exists (
    select 1 from public.platform_admins pa
    join public.app_users au on au.id = pa.user_id
    where pa.user_id = auth.uid() and au.status = 'active'
  );
  ```
  No product decision required (matches G1 suspended-write posture).

## Medium

### F-T05 — No captain decision path; applicant flow dead-ends via PostgREST
- Covered by F-T02 fix (captain RPC). Listed separately because current policies
  make `shortlisted/accepted/declined` unreachable by the authorized party.
  Requires lifecycle decision.

### F-T06 — Unescaped LIKE in team discovery
- **Where:** `20261112000002:177` (`'%' || p_query || '%'` + `ILIKE`, no `ESCAPE`).
- **Fix:** adopt the frozen G1 pattern (`search_player_directory`):
  trim, `left(...,120)`, escape `\`/`%`/`_`, `... ilike v_pattern escape '\'`.
  No product decision required.

### F-T07 — Recruitment lifecycle + expiry unenforced
- **Where:** `20261112000002:59,62` (status CHECK, `expires_at` default only).
- **Defect:** no transition guard (`filled`→`open` allowed), no auto-close on
  expiry, no `expires_at > now()` check. Needs owner lifecycle definition.
  Minimum narrow fix (no product change): `CHECK (expires_at > created_at)`.

### F-T08 — Member/applicant PII disclosure scope unapproved
- **Where:** base SELECT policies `20261112000002:222-223,245-246,284-290`.
- **State:** non-members denied (good); members see roster `user_id`s;
  captains see applicant notes. Intended collaboration surface but no owner
  privacy approval. No code change proposed — owner must approve or narrow.

### F-T09 — Report retention (`CASCADE`) + availability array unbounded
- **Retention where:** `20261112000002:102` (`reporter CASCADE`).
  Fix requires D1-D9: `SET NULL` + evidence-copy procedure (migration + ops doc).
- **Availability where:** `20261112000002:59` (`text[]` no caps, no GIN).
  Narrow fix (no vocab decision): `CHECK (array_length <= 7)`, per-element
  `char_length <= 40`, GIN index. Full allowlist needs D1-D8 word list.

### F-A02 — Audit/cron writes lack DB-boundary admin gate; secret-scan app-only
- **Where:** `20261112000001` (no DEFINER write helper; `findForbiddenAuditKey`
  only in `audit.ts`).
- **Fix options:** (a) document service-role-only + app-`requireSuperAdmin` as
  the boundary with procedural secret review (no SQL change); (b) add
  `record_admin_audit()` DEFINER gated on `is_super_admin()` + active +
  action/target regex + forbidden-key rejection. (b) is a new API surface —
  requires security sign-off; document first.

### F-A03 — `is_super_admin()` read path unused; comments overstate
- **Where:** `20261112000001:4-6,130` vs zero policy references.
- **Fix:** correct comments to "service-role after app auth; no RLS read path in D1"
  OR add explicit `is_super_admin()`-gated read policies (needs owner decision
  on admin visibility). Comment-only fix is narrow.

### F-A04 — `TRUNCATE` bypasses append-only / no-delete triggers
- **Where:** `20261112000001:57-59,121-123` (row triggers don't fire on TRUNCATE);
  grants revoke truncate from anon/authenticated but owner/service-role retain it.
- **Fix:** procedural (restrict owner/service-role truncate via ops runbook +
  event-trigger or pgAudit where available); document that the "any role"
  comment is accurate only for DML, not TRUNCATE.

## Low

- **F-A05** (`...000001:8-13`): first-admin bootstrap undocumented. Fix: runbook
  (dashboard/service-role insert + reason) — ops doc, no SQL.
- **F-A06** (`...000001:47-55,75-101,111-119`): trigger funcs lack
  `SET search_path=''` + revokes. Fix: add `set search_path=''` + explicit
  `SECURITY INVOKER` + `REVOKE ALL ... FROM PUBLIC,anon,authenticated`.
- **F-A07** (`...000001:61-70`): cron data-quality gaps (no
  `completed_at >= started_at`, `error_summary` gating, missing
  `(status, started_at)` index). Fix: additive CHECKs + index.
- **F-T10** (`...000002:52`): `recruitment_posts.game_key` may diverge from
  parent `teams.game_key`. Fix: trigger asserting equality (no product change).
- **F-T11** (`...000002:257-259`): captain may delete owner-member row.
  Fix: trigger protecting last-captain/owner row + leave-vs-remove UX (needs D1-D10).
- **F-T12** (`...000002:23`): `organization_id TEXT NULL` without length/pattern
  guard. Fix: `CHECK (organization_id IS NULL OR char_length <= 120)` + comment
  "non-authoritative, never in RLS".
- **F-T13**: missing secondary indexes (`team_members(user_id)`,
  `recruitment_posts(team_id,status)`, `applications(post_id)`, `reports(target)`).
  Fix: additive `CREATE INDEX` (no behavior change).

## Application readiness

Neither migration is ready. Minimum for re-review: F-T01, F-T02, F-T03 (+F-T04
interim guard), F-A01, F-T06. Remainder require owner decisions (D1-D9/D1-D10/
lifecycle/privacy) or are accepted explicitly as documented limitations with
procedural controls (F-A02/F-A04 runbook).
