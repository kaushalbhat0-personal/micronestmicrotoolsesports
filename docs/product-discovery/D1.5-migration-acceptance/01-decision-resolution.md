# 01 — D1 Decision Resolution (D1-D1 … D1-D12)

Method: each item states the exact question, options, product consequences,
schema/auth/migration-compatibility consequences, a recommendation, whether
owner approval is required, and whether implementation can proceed without it.
No approval is inferred from implementation existence. All 12 items are
**AWAITING OWNER APPROVAL** — 0/12 approved.

Source for current behavior: `09-remaining-product-decisions.md`,
`04-finder-domain-contracts.md`, `05-discovery-database-design.md`,
`20261112000002_d1_teams_discovery.sql`, `src/features/teams/**`.

---

## D1-D1 — Multiple teams per user

1. **Exact question:** May one `app_users` row hold membership in many teams
   simultaneously (tryouts, subs, multi-roster players)?
2. **Options:** (a) Allow `PK(team_id,user_id)` — one user, many teams (current SQL).
   (b) Constrain to one team per user (partial unique on `user_id`).
   (c) Allow many but cap per user (e.g. N teams, app-enforced).
3. **Product consequences:** (a) supports tryouts/subs; abuse surface (roster
   hoarding, ghost memberships). (b) simple but blocks legitimate tryouts.
   (c) compromise, needs a cap number + UX.
4. **Schema/auth/migration compat:** (a) is what shipped:
   `team_members PRIMARY KEY (team_id,user_id)` (`...000002:37-44`) — no per-user
   cap; future cap is additive (CHECK/trigger + app). (b) would need
   `UNIQUE(user_id)` + data migration. (c) needs trigger + counter.
   RLS is unaffected in all cases (row-level, not cardinality).
5. **Recommended option:** (a) allow many, with monitoring (matches tryout reality;
   smallest schema). Add abuse telemetry before caps.
6. **Owner approval required:** Yes.
7. **Safe to proceed without deciding:** Yes for pure logic/DB (current PK is
   compatible with all three futures); no for abuse policy (cap number needs owner).

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.**

## D1-D2 — One team per game vs multi-game teams

1. **Question:** Is a team bound to exactly one `games.key` at creation, or may
   one team span titles?
2. **Options:** (a) One team = one `game_key`, fixed at creation (current:
   `teams.game_key → games RESTRICT`, `teamUpdateSchema` omits `gameKey`).
   (b) Multi-game teams (team + per-game profiles/divisions).
   (c) One team, mutable game (allow `game_key` change).
3. **Product:** (a) BGMI-first, simple; orgs with multi-title rosters need
   multiple team rows. (b) powerful, complex (per-game roles/levels/regions).
   (c) confusing identity, breaks history.
4. **Schema/auth/migration:** (a) current FK + app omission is compatible with
   future (b) via additive division table; (c) would need migration + audit.
   Critical gap: current SQL does **not** enforce immutability at the DB
   boundary — `teams captain update` (`...000002:232-241`) permits
   `game_key`/`slug` overwrite via PostgREST (F-T01). So (a) is intended but
   not DB-guaranteed.
5. **Recommended:** (a) fixed at creation; close F-T01 with column-level grants
   regardless of future multi-title direction.
6. **Owner approval:** Yes (fixes BGMI-first vs multi-title roadmap).
7. **Safe without:** Yes for domain vocabulary (BGMI-only today); no for
   ownership-transfer/update hardening (needs (a) confirmed).

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.**

## D1-D3 — Captain authority; overlap with team ownership

1. **Question:** Who counts as "captain": `owner_user_id`, `created_by`, member
   `role='captain'` — and does `co-captain` confer rights?
2. **Options:** (a) Dual authority: owner/creator OR member-captain; co-captain
   has no rights (current `is_team_captain()`, `...000002:127-141`).
   (b) Owner-only. (c) Member-role-only. (d) Grant co-captain subset rights.
3. **Product:** (a) bootstraps cleanly (owner acts before roster exists) but has
   two roots of authority to keep in sync; unclear UX ("who is the captain?").
   (d) needs an explicit permission list.
4. **Schema/auth/migration:** `is_team_captain()` implements (a) with
   `search_path=''`, `auth.uid()` only — sound helper. Risk is not the helper
   but the **policies that consume it**: teams/member/post update/delete all
   accept (a), and teams UPDATE additionally allows ownership takeover (F-T01).
   Changing to (b)/(c)/(d) is a policy-only migration (no table rebuild).
5. **Recommended:** Keep (a) for D1, explicitly document co-captain = no rights,
   and require app + RLS to use the same helper (no divergent checks).
6. **Owner approval:** Yes (authority model is product, not just security).
7. **Safe without:** Yes for pure matching/search; no for apply (policies +
   F-T01 fix depend on it).

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL + security sign-off.**

## D1-D4 — Independent vs organization-owned teams; org membership authority

1. **Question:** Can teams be owned by organizations, and does org membership
   confer team rights? (`organization_id`, org roles.)
2. **Options:** (a) Teams independent; `organization_id TEXT NULL`, no FK, never
   used in auth (current: `...000002:23`, no RLS reference — correct).
   (b) Org-owned teams (FK + org-role RLS). (c) Hybrid (independent + optional org link).
3. **Product:** (a) ships discovery without building orgs; orgs later need
   migration + UX. (b) blocks D1 on org design. (c) needs clear precedence
   (owner vs org admin).
4. **Schema/auth/migration:** Current (a) is safe **only because** no policy
   reads `organization_id` — verified by grep. Free-text column with no
   CHECK/FK (`TEXT NULL`) reserves the name but permits junk; a future FK needs
   backfill + validation migration. Must never add org-to-team authority without
   an org-membership design (no such table in D1 — correct to omit).
5. **Recommended:** (a) for D1; add length/pattern CHECK + comment
   "non-authoritative, never in RLS" (narrow fix, no product change).
6. **Owner approval:** Yes (org roadmap + whether (a) strands future org teams).
7. **Safe without:** Yes for D1 logic/DB (current column is inert); no for any
   org-aware write path (must not be built until org membership is designed).

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.** Org membership authority:
**NOT DESIGNED — no org table, no org RLS, no org grant; must stay that way in D1.**

## D1-D5 — Regions (BGMI vocabulary)

1. **Question:** Free-text regions vs closed BGMI vocabulary?
2. **Options:** (a) BGMI codes only
   (`india|asia|europe|north-america|south-america|middle-east|online`) in SQL
   CHECKs + Zod (current). (b) Free text. (c) Per-game vocabularies now.
3. **Product:** (a) consistent filtering, blocks "Atlantis" typos; (c) is the
   G1 direction (D-G1-09) but only BGMI exists today.
4. **Schema/auth/migration:** CHECKs in `teams`/`recruitment_posts`
   (`...000002:16,58`) match `player_game_profiles.region_code` (G1) — good.
   Legacy `regionsCompatible` broad tokens (`online` matches everything) are
   kept for reference in `domain/roles.ts:36-48` and must not be used in new
   validation (contract `04` enforces this; `matching.ts` still calls it —
   future route layer must pass vocabulary-checked codes, not free text).
5. **Recommended:** (a) BGMI-only; treat MLBB/others as catalogue additions.
6. **Owner approval:** Yes (vocabulary is product copy + filtering promise).
7. **Safe without:** Yes for pure code (already vocabulary-checked); DB already
   enforces it.

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.**

## D1-D6 — Matching scores

1. **Question:** Numeric compatibility scores vs tiers + factual reasons?
2. **Options:** (a) Forbidden scores; tiers `strong/good/stretch` + reasons
   (current `domain/matching.ts`). (b) Scores. (c) Scores hidden, tiers shown.
3. **Product:** (a) avoids false precision + ranking disputes; (b)/(c) need
   calibration + anti-gaming.
4. **Schema/auth/migration:** No schema impact (pure function). Future scores
   would be app-computed, never stored without a new decision.
5. **Recommended:** (a) tiers only.
6. **Owner approval:** Yes.
7. **Safe without:** Yes — pure logic; DB unaffected.

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.**

## D1-D7 — Verification and trust boundaries

1. **Question:** Are there badges/verified states/tournament-evidence claims in D1?
2. **Options:** (a) Deferred: callers pass `verified=false`,
   `tournamentEvidenceCount=0`; no badges (current contract). (b) Self-attested
   badges. (c) Evidence-backed verification pipeline.
3. **Product:** (a) avoids false trust; matching copy must say "self-reported"
   (current `rankMatch` already does: "Tournament experience self-reported").
   (b) risks impersonation. (c) needs evidence store + reviewer workflow
   (private-verification bucket exists in G1 storage, but no D1 wiring).
4. **Schema/auth/migration:** No D1 column for verification — correct to omit.
   Adding later is additive. Must not overload `is_visible`/`is_public` as trust.
5. **Recommended:** (a) deferred; never render `verified` true until pipeline approved.
6. **Owner approval:** Yes (trust language is product + legal risk).
7. **Safe without:** Yes for code/DB (omit = safe default).

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.**

## D1-D8 — Availability vocabulary

1. **Question:** Closed allowlist for `availability_required` vs free shape?
2. **Options:** (a) Shape-only `text[]` now, allowlist later (current:
   `text[] NOT NULL DEFAULT '{}'` with no DB caps). (b) Closed allowlist now.
   (c) Shape + count/element caps now, allowlist later.
3. **Product:** (a) flexible, risks inconsistent data ("weekend" vs "Weekends").
   (b) clean filters, needs product word list. (c) bounds abuse without freezing words.
4. **Schema/auth/migration:** Current has **zero** DB caps (no length, no GIN —
   unlike G1 `player_game_profiles.availability` which caps `<=7` + GIN).
   (c) is a narrow additive CHECK (`array_length <= 7`, per-element length) that
   does not require the word list. Full allowlist (b) needs owner word list.
5. **Recommended:** (c) now (count + element-length caps + GIN), allowlist later.
6. **Owner approval:** Yes for word list; caps (c) are engineering, low product risk.
7. **Safe without:** Yes for logic; DB should gain caps before apply (F-T09).

Status: **RECOMMENDED (c), AWAITING OWNER APPROVAL for allowlist.**

## D1-D9 — Report visibility, retention, moderation responsibility

1. **Question:** Who reads reports, how long are they kept, who moderates, and
   what survives account deletion?
2. **Options:** (a) Reporter CASCADE (current: `reports.reporter → app_users CASCADE`,
   `...000002:102`): account purge deletes reports. (b) `SET NULL` + evidence copy.
   (c) Hard retain + purge scheduler.
   Visibility: (i) reporter insert-only, reads admin-only (current: no select
   policy, insert-only grant); (ii) reporter can read own reports; (iii) public stats.
3. **Product:** (a) loses moderation evidence on purge — unacceptable if reports
   allege abuse. (b) preserves queue at cost of orphan rows. Visibility (i) is
   safe but poor UX (reporter gets no receipt); (ii) needs a narrow own-read policy.
4. **Schema/auth/migration:** Current RLS (insert-only, no select/update/delete)
   correctly enforces (i). Retention is the gap: CASCADE is a product choice with
   moderation consequences. Changing to `SET NULL` is a small FK migration but
   needs the evidence-copy procedure (what fields survive, who may view).
5. **Recommended:** (b) `SET NULL` + reviewer evidence-copy procedure; visibility
   stays (i) for D1, add (ii) only with explicit owner approval + policy.
6. **Owner approval:** Yes — required (retention + moderation SLA are product/legal).
7. **Safe without:** Yes for code/DB shape; no for apply (retention must be decided
   before real reports exist).

Status: **AWAITING OWNER APPROVAL (both retention and visibility).**

## D1-D10 — Team owner account deletion; owner transfer

1. **Question:** What happens when an owner deletes their account, and how does
   ownership transfer?
2. **Options:** Transfer: (a) dedicated transfer RPC (owner → active member,
   audit). (b) Direct `UPDATE owner_user_id` by captain (current SQL permits —
   F-T01, unsafe). (c) Manual admin path only. Deletion: (i) `RESTRICT` forces
   transfer-first (current: `owner_user_id → app_users RESTRICT`); (ii) cascade/
   set-null with fallback owner.
3. **Product:** (i)+(a) is the safe story (no orphan teams, audited handoff).
   (b) is privilege escalation. (c) does not scale.
4. **Schema/auth/migration:** `RESTRICT` on `owner_user_id`/`created_by`
   (`...000002:22,25`) correctly blocks owner-row delete while teams exist —
   compatible with G1 (whole-account delete excluded from G1-7). But without a
   transfer RPC, RESTRICT strands teams (owner cannot leave). And (b) is
   currently possible via PostgREST — must be closed with column-level grants.
5. **Recommended:** (i) + (a): keep RESTRICT, build narrow transfer RPC
   (next phase), close direct UPDATE. Document manual admin path as interim.
6. **Owner approval:** Yes — required (ownership is product + support burden).
7. **Safe without:** Yes for D1 logic; no for apply with real users (stranding risk).

Status: **AWAITING OWNER APPROVAL.**

## D1-D11 — Billing / entitlement

1. **Question:** Any paywalls on roster intake or discovery in D1?
2. **Options:** (a) None — intake + discovery free, no gates (current: no
   entitlement column, no policy reference). (b) Gated discovery/rosters.
3. **Product:** (a) maximizes seeding; (b) needs pricing + enforcement.
4. **Schema/auth/migration:** (a) means no entitlement columns — correct to omit.
   Adding later is additive; legacy billing tables must never be imported
   (register `08` correctly rejects them).
5. **Recommended:** (a) none in D1.
6. **Owner approval:** Yes (pricing is owner).
7. **Safe without:** Yes — omission is safe.

Status: **RECOMMENDED (a), AWAITING OWNER APPROVAL.**

## D1-D12 — Migration acceptance

1. **Question:** Are `20261112000001` + `20261112000002` safe and sufficiently
   specified for a later apply to `knniommcyyhbyiwljisk`?
2. **Options:** (a) Accept. (b) Accept with conditions. (c) Reject / not accepted.
3. **Consequences:** Apply creates 8 new tables/functions/policies in production;
   rollback is drop-in-reverse (G1 untouched) but real user data + reports would
   be at risk if RLS is wrong.
4. **Schema/auth/migration:** See `02`, `03`, `04`, `06`: 2 Critical + 3 High
   findings block acceptance. Pre/post table-list evidence procedure is specified
   in `05-discovery-database-design.md` §Rollback but has not been executed
   (correct — no remote access in D1.5).
5. **Recommended:** (c) NOT ACCEPTED. Fix F-T01/F-T02/F-T03/F-A01/F-T06 first,
   re-review, then replay-test, then seek explicit apply authorization.
6. **Owner approval:** Yes — security + product sign-off required (per `09` gate).
7. **Safe without:** N/A — this decision IS the gate; nothing applies without it.

Status: **NOT ACCEPTED, AWAITING OWNER + SECURITY SIGN-OFF.**

---

## Cross-cutting items explicitly covered

- **Recruitment-post lifecycle** (open/paused/closed/filled, expiry): no D-number
  in `09`; status CHECK exists but no transition guard and no expiry enforcement
  (`expires_at` default +30d only). Treated as part of D1-D12 acceptance: needs
  owner lifecycle definition before apply (F-T07). Pure CRUD may proceed; status
  automation may not.
- **Duplicate/repeated applications:** partial unique `(post_id, applicant)`
  where active (`...000002:91-93`) implements "no double active apply" with
  race safety; re-apply after withdraw/decline is permitted by design. Needs
  owner confirmation (spam window, max attempts) — part of D1-D12.
- **Applicant privacy / masked discovery:** base-table applicant PII visible
  only to applicant + post-captain (correct isolation); public discovery is
  RPC-masked with no applicant exposure (correct). Member-roster `user_id`
  exposure to fellow members is authorized disclosure pending owner privacy
  sign-off — part of D1-D12.
- **BGMI vs multi-title:** D1-D2 + D1-D5 jointly resolve: BGMI-only now,
  catalogue-row + CHECK per future title (matches D-G1-09). No multi-title
  code or migration in D1.
