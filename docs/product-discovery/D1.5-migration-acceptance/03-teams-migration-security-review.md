# 03 — Teams Migration Security Review (`20261112000002`)

File: `supabase/migrations/20261112000002_d1_teams_discovery.sql` (347 lines).
Contracts: `04-finder-domain-contracts.md`, `05-discovery-database-design.md`,
`src/features/teams/schemas/team.ts`, `src/features/teams/services/search.ts`.

## Per-table audit

### `teams` (11–27)

- **Owner:** creator (`owner_user_id` + `created_by`, both `→ app_users RESTRICT`).
- **Readers:** owner/creator/member (`teams owner select`, 222–223). No anon base read.
- **Writers:** insert owner=self+active (225–230); update captain+active (232–241);
  delete: **no policy** → denied despite `GRANT DELETE` (316–318). Comment
  "captain (via policy…)" is inaccurate.
- **Anon:** none on base table (revoked 315–316). Public reads via RPCs only.
- **Direct vs RPC:** members read base table directly (sees internals);
  public reads RPC-masked (`search_teams`, `get_team_by_slug`).
- **Cross-user/team isolation:** `auth.uid()` + `is_team_member/captain()` — sound.
- **Org behavior:** `organization_id TEXT NULL` (23), no FK, never in RLS — honored
  as non-authoritative. No length/pattern guard (F-T12).
- **Delete/transfer:** team delete cascades members/posts (CASCADE) — intended.
  No delete policy = delete blocked. Transfer via direct UPDATE =
  **F-T01 Critical** (ownership/game/slug takeover).
- **Sensitive columns / projection:** `owner_user_id/created_by/organization_id`
  hidden from RPC output (208–211) but visible to members via base SELECT —
  authorized disclosure, needs privacy sign-off (F-T08).

### `team_members` (38–44)

- **Owner:** the member user (`user_id → app_users CASCADE`).
- **Readers:** member of team OR own row (245–246). No anon.
- **Writers:** captain insert/update/delete (248–259). **No `active` check** (F-T03).
  Captain may insert **any** `user_id` (no consent/active/linkage check — F-T04).
- **Delete/transfer:** captain may remove any row incl. owner-member row (stranding
  nuance, F-T11). `user_id CASCADE` removes membership on account purge (correct).
- **Sensitive:** `user_id` (auth ids) visible to fellow members — needs owner
  privacy approval (F-T08).

### `recruitment_posts` (51–66)

- **Owner:** team (via `team_id CASCADE`); `created_by → app_users RESTRICT`.
- **Readers:** owner/creator/member-team only (263–267). Open posts **not**
  publicly readable via base table (correct per D1; public post discovery RPC
  deferred — lifecycle decision D1-D12).
- **Writers:** captain insert (`created_by=self`, 269–271 — **no active check**,
  F-T03); captain update/delete (273–280, no active check on update/delete).
- **Sensitive:** no PII beyond team linkage; `availability_required text[]`
  unbounded (F-T09).

### `applications` (76–86)

- **Owner:** applicant (`applicant_user_id → app_users CASCADE`).
- **Readers:** applicant OR post-captain (284–290). No anon.
- **Writers:** applicant insert (`applicant=self`, `status='applied'`, active —
  292–298, correct); applicant update **overbroad** (300–303, **F-T02 Critical**);
  **no captain decision policy** — captain accept/shortlist/decline impossible
  via PostgREST (must be future server op).
- **Delete:** none (correct) + `GRANT` omits delete (332–333).
- **Dedup:** partial unique active `(post_id, applicant)` (91–93) — race-safe,
  re-apply after terminal state permitted (needs owner spam-window decision).
- **Sensitive:** `note ≤200` + `applicant_user_id` visible only to authorized
  parties — correct isolation.

### `reports` (100–108)

- **Owner:** reporter (`reporter_user_id → app_users CASCADE`).
- **Readers:** none via PostgREST (no select policy — admin boundary only).
- **Writers:** reporter insert-only (`reporter=self`, `status='open'`, active —
  306–312). No update/delete (correct).
- **Retention:** `CASCADE` deletes reports on reporter purge — evidence-loss risk
  (F-T09 / D1-D9, High discussion in `01`). No `SET NULL`/evidence-copy.
- **Sensitive:** `reason 10–1000` + `target_id` admin-only — correct confidentiality.

## Helpers & RPCs

- `is_team_member(uuid)` (114–125), `is_team_captain(uuid)` (127–141):
  `SECURITY DEFINER`, `search_path=''`, `auth.uid()` only, no user-id params —
  sound. Grants authenticated-only (340–343). Dual authority
  (owner/creator/member-captain) matches D1-D3(a) but needs owner sign-off.
- `search_teams(...)` (147–180), `get_team_by_slug(text)` (182–206): DEFINER,
  masked columns (no owner/created/org), `member_count` derived, `is_public`
  enforced, grants anon+authenticated (344–347) — correct public path.
  **LIKE injection (F-T06 Medium):** `'%' || p_query || '%'` with `ILIKE`, no
  `ESCAPE`, no trim/cap — `%`/`_` act as wildcards (G1 fixed this with
  `ESCAPE '\'`; D1 repeats it). `p_limit` bounded 1–60 (good); `p_offset ≥0`
  unbounded (DoS-minor); `game_key` consistency with parent team unchecked (F-T10).

## Required property tests (static verdicts; replay execution deferred per constraints)

| Property | Verdict |
|---|---|
| Users cannot modify another user's team | FAIL (F-T01: member-captain can overwrite owner/game/slug/org) |
| Non-members cannot perform captain/owner actions | PASS for non-members (RLS denies); FAIL for member-captain scope (overbroad columns) |
| Member cannot promote self to captain | PASS at RLS (needs captain already); captain can promote anyone (needs D1-D3 decision) |
| Org membership cannot bypass team permissions | PASS (no org RLS reference; column inert) |
| Public discovery hides membership/applicant PII | PASS (RPC masks; anon base denied; applicant rows not in RPC output) |
| Applications visible only to authorized parties | PASS (applicant-or-captain select) |
| No double apply where prohibited | PASS at DB (partial unique, race-safe); re-apply policy needs owner sign-off |
| Reports insert-only, not publicly readable | PASS (insert-only + no select) |
| Suspended/inactive blocked on protected writes | FAIL (F-T03: members/posts lack active gate; F-A01 analogous) |
| Direct RPC cannot bypass server auth | PARTIAL (RPCs are reads; applicant UPDATE bypasses intended withdraw-only — F-T02) |
| Public RPCs bounded + safe filtering | PARTIAL (limit bounded; LIKE wildcards unescaped — F-T06) |
| Base-table grants route around masked RPCs | PASS for non-members (denied); members see internals by design (needs privacy sign-off, F-T08) |

## Constraints / races / ownership / RLS interaction

- FKs: `game_key → games RESTRICT` (no orphan titles); `owner/created_by RESTRICT`
  (transfer-first, strands without transfer RPC — D1-D10); members/applicants/
  reporter `CASCADE` (purge removes roster/applications/reports — reports need D1-D9).
- Partial unique + PK uniqueness are race-safe; slug conflict → unique violation
  (app maps to conflict error per contract).
- `handle_updated_at()` reuse is safe (existing hardened function, not replaced).
- DEFINER helpers bypass RLS narrowly with `auth.uid()` predicates — no confused
  deputy (no caller-supplied identity, no `search_path` attack surface).
- Missing covering indexes for future scale (F-T13 Low); no predicate confuses
  `is_public` with member visibility.

## Verdict on this migration

**NOT ACCEPTED.** F-T01 + F-T02 are Critical (ownership takeover; application
forgery). F-T03/F-T04 are High. F-T06–F-T09 must be fixed or explicitly accepted
with owner sign-off. Exact corrections in `06`.
