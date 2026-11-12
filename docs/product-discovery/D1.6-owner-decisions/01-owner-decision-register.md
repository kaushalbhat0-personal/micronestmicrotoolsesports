# 01 — Owner Decision Register (D1-D1 … D1-D12)

Status key: every item below is **AWAITING OWNER APPROVAL**. "Recommended" is the
reviewer's position, never an approval.

## Amendment D1.6.1 (2026-11-11) — approved architecture principle (history preserved)

The owner approved the multi-esports architecture principle (BGMI as first
title; identity/discovery/team/org architecture multi-title-ready; incremental
per-title catalogues, profiles, roles, validation; platform identity separate
from game identity). Exact wording: D1.6.1
`01-approved-architecture-principle.md`. This amendment changes no row below:
D1-D1…D1-D12 remain AWAITING, and D1-D5's detailed vocabulary/validation
contract is explicitly NOT approved by the principle — it still requires the
exact-behavior response in `08`.

"Blocks acceptance: YES" on a row means the migration sequence cannot be
accepted while the item is undecided (either the code path is fail-closed-
blocked, or the behavior is unspecified).

---

## D1-D1 — Multiple teams per user

- **Question:** May one user hold membership in many teams at once?
- **Options:** (a) Unlimited memberships (current schema: `PK(team_id,user_id)`).
  (b) Capped memberships (e.g. max N teams, app + trigger enforced). (c) One
  team per user (unique `user_id` in `team_members`).
- **Recommended:** (a) unlimited, with abuse monitoring.
- **Rationale:** tryouts and substitute stints are legitimate multi-team states;
  a cap number today would be invented without usage data.
- **Product consequences:** (a) supports tryouts; opens roster-hoarding and
  ghost memberships. (b) needs a cap number + UX for the cap. (c) simplest
  against abuse, blocks tryouts.
- **Database/security consequences:** current PK supports all three futures;
  (b)/(c) are additive migrations later. RLS unaffected (row-level, not
  cardinality). No auth change.
- **Dependencies:** informs D1-D12 duplicate/re-apply rules; org rosters later.
- **Blocks acceptance:** NO (schema compatible; abuse policy can follow).

## D1-D2 — Team game association

- **Question:** Is a team bound to exactly one game, or may it span titles?
- **Options:** (a) Exactly one `games.key`, fixed at creation (current schema +
  app omission of `gameKey` from updates; DB freeze enforced by 000003 §D).
  (b) Multi-game teams (divisions or per-game profiles under one team).
- **Recommended:** (a) one game per team.
- **Rationale:** BGMI-first; roles, regions, and levels are per-game vocabularies
  (frozen D-G1-09 direction); multi-game is a data-model redesign, not a flag.
- **Product consequences:** (a) multi-title orgs use multiple team rows.
  (b) richer but needs division UX, per-game recruitment, cross-game identity.
- **Database/security consequences:** (a) is enforced at grant + trigger level
  now; (b) needs new tables + RLS and a migration of existing rows.
- **Dependencies:** D1-D5 (catalogue), D1-D12 (per-post game must equal team game
  — currently unchecked, F-T10 BLOCKED).
- **Blocks acceptance:** NO for (a); YES if (b) — do not apply until modeled.

## D1-D3 — Captain authority model

- **Question:** Who may publish/close recruitment posts, accept/reject
  applications, remove members, and appoint/revoke captains — owner, captain
  role-holders, both, and what of co-captains?
- **Options:** (a) Dual authority: `owner_user_id`/`created_by` OR member
  `role='captain'`; `co-captain` has no rights (current helper; captain
  *decision* writes still blocked pending this decision). (b) Owner-only.
  (c) Member-role-only. (d) Co-captain granted a defined subset.
- **Recommended:** (a) with an explicit permission matrix (see `02`).
- **Rationale:** owner must be able to act before any roster exists; member
  captains must be able to run day-to-day recruitment. Co-captain stays
  rightless until its subset is specified — inventing it now risks privilege creep.
- **Product consequences:** (a) two roots of authority to display in UX
  ("owner" vs "captain" must be distinguishable). (d) needs a per-capability list.
- **Database/security consequences:** helper `is_team_captain()` implements (a);
  whichever option is chosen, policies + a captain-decision RPC must match it
  exactly (F-T05 blocked until then). Changing options later is policy-only.
- **Dependencies:** D1-D10 (does ownership imply captaincy?), D1-D12 (who
  decides applications).
- **Blocks acceptance:** YES — captain decision writes are currently denied
  entirely; acceptance with live recruitment needs this matrix.

## D1-D4 — Independent vs organization-owned teams

- **Question:** May organizations own teams, and does organization membership
  confer team rights?
- **Options:** (a) Independent teams only. (b) Independent + inert
  `organization_id` text reference, never authoritative (current). (c) Full
  org ownership (FK + org-role RLS).
- **Recommended:** (b) for D1; org authority undesigned and must stay out.
- **Rationale:** ships discovery without building organizations; storing a
  reference is not the same as granting authority — no RLS reads
  `organization_id` today, and that must hold until org membership exists.
- **Product consequences:** (c) blocks D1 on org design (members, roles,
  billing owner). (b) defers that cost; a future FK needs backfill + validation.
- **Database/security consequences:** (b) is safe only while the column stays
  out of every USING/WITH CHECK (verified). (c) needs org tables first.
- **Dependencies:** D1-D10 (owner vs org-admin precedence).
- **Blocks acceptance:** NO for (a)/(b); YES for (c).

## D1-D5 — Game vocabulary (BGMI-first)

- **Question:** Which roles, regions, play-modes, and availability values exist?
- **Options:** (a) BGMI-only closed sets (current: roles
  `IGL/Assaulter/Support/Scout`; regions incl. `online`; play-modes
  `squad/duo/solo/tpp/fpp`). (b) Per-game sets now. (c) Free text.
- **Recommended:** (a).
- **Rationale:** matches the G1 seed catalogue and frozen D-G1-09 direction
  (separate vocabularies per game); avoids multi-title assumptions with one title.
- **Product consequences:** new titles arrive as catalogue row + CHECK, never a
  redesign. (c) would break filtering and matching.
- **Database/security consequences:** CHECKs enforce (a); adding a title is a
  small migration + Zod update. Regions in matching must use vocabulary codes,
  not legacy broad tokens.
- **Dependencies:** game catalogue; D1-D2; D1-D8 (availability words).
- **Blocks acceptance:** NO.

## D1-D6 — Team tiers

- **Question:** Are tiers (`casual…professional`) display labels, verified
  classifications, or self-reported context?
- **Options:** (a) Self-reported labels only, never implying verification
  (current code + `SELF_REPORTED_LEVEL_NOTE`). (b) Verified classifications.
  (c) Display labels with hidden verification.
- **Recommended:** (a).
- **Rationale:** no verification pipeline exists; implying achievement would be
  false trust and a moderation liability.
- **Product consequences:** (a) requires "self-reported" copy wherever tiers
  appear. (b) needs evidence + reviewer workflow (out of D1).
- **Database/security consequences:** none (pure function + text columns).
- **Dependencies:** D1-D7 (trust language).
- **Blocks acceptance:** NO (copy constraint only).

## D1-D7 — Verification

- **Question:** What does "verified" mean, and does D1 have any of it?
- **Options:** (a) Deferred: all D1 callers pass `verified=false`,
  `tournamentEvidenceCount=0`; no badges (current contract). (b) Narrow
  pipeline (e.g. BGMI-ID ownership check). (c) Self-attested badges.
- **Recommended:** (a) defer.
- **Rationale:** (c) invites impersonation; (b) needs evidence store wiring +
  reviewer SLA. Email confirmation (D-G1-10) proves mailbox control only —
  never identity, skill, ownership, or legitimacy.
- **Product consequences:** matching copy must say "self-reported"; `verified`
  must never render true.
- **Database/security consequences:** no verification column exists (correct);
  adding one later is additive + needs its own approval.
- **Dependencies:** D1-D6; private-verification bucket (exists, unwired).
- **Blocks acceptance:** NO (omit = safe default).

## D1-D8 — Availability representation and caps

- **Question:** Structured fields, free text, or shape-only array — with what caps?
- **Options:** (a) Shape-only `text[]` now (current, unbounded). (b) Shape +
  count/element caps now, word allowlist later (recommended). (c) Closed
  allowlist now.
- **Recommended:** (b) — e.g. max 7 entries (G1 parity), per-element length
  bound, GIN index; words stay open.
- **Rationale:** bounds abuse/storage without freezing product vocabulary;
  mirrors the G1 `availability` column contract.
- **Product consequences:** (c) needs the word list today; (a) permits junk
  and inconsistent filters.
- **Database/security consequences:** (b) is an additive CHECK + index; no RLS
  impact; full allowlist later is a second small migration.
- **Dependencies:** D1-D5 (word list when closed).
- **Blocks acceptance:** NO for (a)/(b) — but (a) should be time-boxed; YES for
  (c) (needs the list).

## D1-D9 — Reports, visibility, retention

- **Question:** Who sees a report (reporter? reported party? reviewers?), who
  reviews it, and what survives account/team deletion?
- **Options — visibility:** (i) reporter insert-only, reads admin-boundary only
  (current: no select policy). (ii) + reporter can read own reports.
  (iii) + reported party notified/sees. **Options — retention on reporter
  delete:** (A) `CASCADE` deletes reports (current — evidence lost). (B) `SET
  NULL` + reviewer evidence snapshot (recommended). (C) hard retain + purge job.
- **Recommended:** (i) + (B); (ii) only with explicit approval + narrow own-read
  policy; (iii) needs moderation-SLA design (deferred).
- **Rationale:** (A) destroys moderation evidence on the account purge it is
  meant to judge; (B) preserves the queue at the cost of orphan rows + a
  documented evidence-copy procedure.
- **Product/privacy consequences:** (B) keeps reporter-linked data past account
  deletion — needs a retention notice; (iii) changes reporter safety whiskers.
- **Database/security consequences:** (B) is a small FK migration
  (`SET NULL`) + ops procedure; (ii) is a narrow SELECT policy. No broad access.
- **Dependencies:** account/team deletion flows; moderation SLA (open D-08).
- **Blocks acceptance:** YES with live reports — real user reports must not land
  under undecided retention. No invention of a retention period here.

## D1-D10 — Ownership transfer and interim administration

- **Question:** Is ownership transferable, by whom, with what acceptance, and
  what happens when an owner is suspended or disappears?
- **Options — transfer:** (1) dedicated transfer RPC: current owner initiates →
  active member must accept → audit (recommended). (2) direct UPDATE by captain
  (rejected — was F-T01). (3) manual admin path only. **Interim admin:**
  (x) none — suspended owner's teams freeze for writes needing active status.
  (y) designed interim role (needs full design).
- **Recommended:** (1) + (x) for D1; scope + procedure need approval.
- **Rationale:** (2) is privilege escalation, already closed at grant/trigger
  level and must stay closed. (1) keeps the audit trail RESTRICT was designed
  for (`owner/created_by RESTRICT` forces transfer-first on account delete).
- **Product consequences:** without (1), an owner who leaves strands the team
  (RESTRICT blocks account-row delete while teams exist); support needs the
  interim story before real users.
- **Database/security consequences:** transfer RPC must own a revision of the
  immutable-team trigger (FWD-02) with old-owner + active-member + audit checks;
  captain authority does not change implicitly with ownership unless decided.
- **Dependencies:** D1-D3 (owner vs captain), D1-D4 (org-admin precedence),
  immutable-team trigger.
- **Blocks acceptance:** YES with real teams — stranded-team and
  suspended-owner behavior must be specified first.

## D1-D11 — Billing

- **Question:** Is D1 discovery/recruitment free?
- **Options:** (a) free: no gates on intake, discovery, or posting (current: no
  entitlement columns/policies). (b) gated tiers.
- **Recommended:** (a) for D1.
- **Rationale:** maximizes seeding; pricing needs its own product + enforcement
  design. Legacy prices/plans must never be restored (extraction register).
- **Product consequences:** separates platform access / discovery / posting /
  future premium as distinct later decisions.
- **Database/security consequences:** none (omission is safe; gates later are
  additive).
- **Dependencies:** none in D1.
- **Blocks acceptance:** NO.

## D1-D12 — Recruitment lifecycle and privacy (critical contract)

- **Question:** Full state model: post states (draft/published/paused/closed/
  expired), expiry, application states, withdrawal, captain decisions,
  duplicates/re-apply, visibility, deletion cascades, auditability.
- **Options:** summarized as composable choices (detail in `03`):
  - Post states: open/paused/closed/filled + `expires_at` (current, no transition
    guards, no auto-close) vs guarded transitions + expiry automation.
  - Application states: applied/shortlisted/accepted/declined/withdrawn with
    partial-unique anti-double-active (current) vs + re-apply windows/attempt caps.
  - Decisions: currently BLOCKED (no captain path) vs captain RPC with audit.
  - Visibility: applicant sees own; captain sees post applicants (current RLS);
    public sees nothing applicant-related (current RPC masking) — member-roster
    `user_id` visibility to teammates is the open privacy point.
  - Deletion: team delete cascades posts/applications (current); post delete
    cascades applications (current).
- **Recommended:** approve the contract in `03` as the frozen v1: guarded
  transitions, expiry rule, withdraw semantics, duplicate window, re-apply rule,
  visibility matrix, cascade table, decision audit — or explicitly defer each
  line with risk acceptance. The captain decision RPC stays unbuilt until (at
  minimum) D1-D3 + this contract are approved.
- **Rationale:** recruitment writes user-to-user consequences (rejection,
  removal); unspecified transitions become support and safety incidents.
- **Database/security consequences:** transitions need trigger/policy
  enforcement (extends the withdraw trigger pattern); F-NEW-01 fix rides with
  this contract (insert `decided_*` nullness); expiry automation needs a
  scheduler decision or app-enforced rule.
- **Dependencies:** D1-D3 (who decides), D1-D10 (transfer vs captain), F-NEW-01,
  withdraw trigger (FWD-01), D1-D5 vocabulary.
- **Blocks acceptance:** YES — the most blocking decision in the register.
