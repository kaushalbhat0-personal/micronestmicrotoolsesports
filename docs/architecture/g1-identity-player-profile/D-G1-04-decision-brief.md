# D-G1-04 Decision Brief — `game_user_id` in the Player Game Profile Domain

Status: DECISION BRIEF ONLY — no approval granted, no implementation authorized.
Scope: D-G1-04 only. Does not modify migrations, application code, schema, or frozen documents.
Gate: G1-4 requires D-G1-03 (APPROVED, frozen) + D-G1-04 resolution. This brief is the pre-G1-4 input.

## 1. Original decision wording

Source: `10-open-decisions.md` § D-G1-04 (verbatim):

> ## D-G1-04 — `game_user_id` in projection: omit vs masked
> - Question: Omit entirely in G1 (recommended) or show masked last-4?
> - Options: (a) Omit (recommended — no need demonstrated). (b) Masked.
> - Recommendation: (a); revisit only with concrete consumer need.
> - Impact: RPC output list.
> - User approval required: Yes (privacy).

Classification in `10` § "Remaining open decisions — stage gates" and `11` §6:

> D-G1-04 omit vs masked `game_user_id` — open. Gate: before G1-4 output freeze.

The as-written decision is narrow: **projection treatment only** (omit vs masked last-4 in the G1-4 RPC output). It is not, as written, a decision to collect, require, verify, search, deduplicate, or share the identifier in recruitment workflows. The 12 dimensions in this brief (§4) are an expansion requested for the product-owner review; only the projection question gates G1-4 (§7).

## 2. Current implementation facts (verified against schema + code, not reports alone)

### 2.1 Persistence

File: `supabase/migrations/20261110000006_g1_game_catalogue.sql:75-77,105-106`.

- `player_game_profiles.game_user_id text NULL CHECK (game_user_id IS NULL OR char_length(game_user_id) BETWEEN 4 AND 32)`.
- Type is text (preserves leading zeroes, e.g. `001234`). Trimmed at the Zod boundary; no format lock (numeric-looking but not numeric-confirmed). This matches `01` U4: "keep text + length cap, no format lock".
- NULL allowed. No default (absent = NULL at insert unless supplied).
- No `UNIQUE (game_key, game_user_id)` constraint. Duplicates allowed by design. Rationale recorded in `05` §1 and migration comment: identifier is unverified; uniqueness would assert a global-per-title identity property the platform cannot prove.
- No FK from `game_user_id` to anything (`05` §2: "No FK from `game_user_id` to anything (unverified external identifier)").
- No `verification_status`, `verification_method`, `verified_at`, `evidence_id`, rank, score, K/D, or badge columns. Confirmed absent from the migration. The reserved future column name `verification_status` was deliberately not added (`03` §6, `02` lifecycle, G1-3 report §5).
- BGMI is the only seeded catalogue row (`bgmi` / `Battlegrounds Mobile India` / `BGMI` / active).

### 2.2 Access control (RLS + grants, live-verified per G1-3 report §6)

- RLS enabled on `player_game_profiles`. Exactly 3 policies, all `authenticated`-only:
  - SELECT `USING (player_user_id = auth.uid())` (reads allowed even when suspended).
  - INSERT / UPDATE with owner bind + inline active-status `EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND status = 'active')`.
- No owner DELETE policy/grant (deferred with D-G1-07). No anon policies on game-profile rows.
- Grants: `SELECT, INSERT, UPDATE` to `authenticated` only; `DELETE/TRUNCATE/REFERENCES/TRIGGER` revoked. Nothing to `anon`/`public` on this table.
- `games`: public SELECT to `anon, authenticated`; zero write policies (seeding via migration/service-role only).
- Consequence: `game_user_id` is owner-private at the database layer today. Anon and authenticated non-owners return 0 rows on base-table reads. There is no public base-table path.

### 2.3 Application boundary

- Schema: `src/features/player-profile/schemas/game.ts:86-94` — `gameUserIdSchema`: optional trimmed string, 4–32 chars. Comment states owner-private, omitted per D-G1-03, masked form open under D-G1-04.
- Create: `schemas/game-profile.ts:29-51` — `game_user_id` optional in strict create input; region re-validated per `game_key` dispatcher (unknown game fails closed).
- Update: `schemas/game-profile.ts:61-72` — `game_user_id` nullable-optional in strict patch (`null` clears, `undefined` leaves unchanged, missing key rejected only if whole patch empty). `player_user_id`/`id`/`game_key`-in-patch rejected (`.strict()` + mass-assignment guard, `08` T4).
- Server: `server/game-profile.ts:52-53,62,85-100,205-224,290-291` — explicit column lists (no `select *`); `game_user_id` persisted (`?? null`) and returned **only on own rows** (`getOwnGameProfiles`, `createGameProfile`, `updateGameProfile`); identity exclusively from `auth.getUser()` (no user-ID parameter); `ensureAppUser` gate (suspended blocked); canonical-profile-exists gate; active-catalogue gate. No service-role, no `next/headers`, generic domain errors only.
- What is NOT implemented: no search by `game_user_id`, no duplicate detection on it, no verification workflow, no masked-derivation helper, no public reader returning it, no RPCs at all (G1-4 owns them — none exist in `supabase/migrations/`).

### 2.4 Projection contract today

- `src/features/player-profile/domain/public-projection.ts:5-18` — frozen 12 columns: `handle, display_name, avatar_url, bio, country_code, game_key, game_name, ign, primary_role, play_modes, region_code, availability`.
- `tests/public-projection.test.ts:12-47` — asserts exact 12-column equality and asserts `game_user_id` (plus `user_id`/`id`/email/evidence/timestamps/flags) is **not** a projection column. This is a scaffold mirror; the authoritative G1-4 RPC key-set test is still planned (`12` §5).
- No masking function exists in `src/`. The only masked pattern in the repo is the legacy reference `('****' || right(g.character_id, 4))` in `ref/legacy-project/supabase/migrations/20251122000001_finder_public_view_bio.sql:37`, which `04` §6 cites "for reference only; not approved".

## 3. What is already frozen / approved vs open

### 3.1 Already APPROVED (frozen, do not re-decide)

- D-G1-01 (lazy bootstrap), D-G1-02 (no owner UPDATE on `app_users`), D-G1-03 (RPC-only projections with the safeguards listed in `10` § D-G1-03 and `11` §3), D-G1-09 (separate `country_code` / per-game `region_code` vocabularies). Provenance: `11` §2.
- Frozen 12-column projection (`11` §3, `04` §5, `05` §5, `domain/public-projection.ts`). `game_user_id` is excluded. Timestamps omitted. No `SELECT *`. Consent predicate `is_discoverable AND is_visible AND status='active' AND is_active`. `LIMIT` 1..48 + bounded `OFFSET`. Handle syntax, bounded query, allowlisted enums, `ILIKE` escaping with `ESCAPE '\'`. 404-equivalence. `REVOKE ALL FROM PUBLIC` + least grants.
- Self-declared status of all G1 game fields (`03` §6, `01` FR-GM-04, `02` lifecycle): G1 must not render verification chrome (no "verified" string, checkmark, score).
- Owner-private default: `game_user_id` is an owner-private column; anon/non-owner base reads return 0 rows (`05` §3–§4, `04` §5, `08` T1–T3).

### 3.2 Already IMPLEMENTED (G1-3 PASS, additive, no projection)

- Collection + storage as optional, unverified, owner-private text (4–32), duplicates allowed, changeable/clearable by the owner (NULL semantics in update schema), no uniqueness, no verification.
- Owner CRUD (minus DELETE, deferred with D-G1-07) with session-derived identity, Zod + CHECK parity, explicit column lists.
- Catalogue + per-game region dispatcher (BGMI-only vocabulary; unknown games fail closed).

### 3.3 Remains UNDECIDED (D-G1-04 and its 12-dimension expansion)

- As-written D-G1-04: omit vs masked last-4 in the G1-4 RPC output. Open; gates G1-4 (`11` §7: "G1-4 requires D-G1-03 + D-G1-04 resolution").
- Expanded dimensions put to the owner in this brief (§4): whether to collect at all; optional vs required; private vs shared vs public; masked usefulness; ownership verification and its feasibility; searchability; duplicate detection; recruitment-workflow use; mutability/removal; IGN separation; cross-title identifier-type support.
- Explicitly NOT decided by G1-3: any public return of `game_user_id` (full or masked), any verification claim, any search/filter/duplicate use, any recruitment-surfacing rule, any removal/deprecation migration.

### 3.4 What G1-4 requires (minimum)

- A projection decision: keep the frozen 12 columns unchanged with `game_user_id` excluded (full and masked forms), or approve a precisely specified masked addition with its own consent predicate. G1-4 must not invent masking, verification, search, or sharing semantics beyond what the owner approves here. See §7.

## 4. Decision dimensions (analyzed independently)

1. **Whether to collect at all.** Collecting creates a sensitive-identifier store with no demonstrated G1 consumer (directory search/filter in `07`/`09` uses game/role/region/query — never ID). Data-minimization (NFR-02) argues against collecting without a purpose. Counterpoint: early collection lets owners pre-fill a future recruitment handoff. G1-3 already persists the column; "do not collect" now means deprecate/remove (§ Option D), not "never stored".
2. **Optional vs required for particular workflows.** Today optional at every layer (NULL, Zod optional, no workflow gates on it). Making it required would block profile creation for users who do not know or will not share their title ID, with no trust gain (self-declared either way). No frozen workflow requires it; recruitment workflows are future domains.
3. **Private vs selectively shared vs publicly discoverable.** Three distinct postures: (i) owner-only (current DB fact); (ii) consented sharing to a narrow audience (e.g. an accepted team/org after application acceptance — future, not G1); (iii) public projection (directory/API). (ii) and (iii) have完全不同的 consent, enumeration, and harassment implications. They must not be approved as one step.
4. **Whether a masked representation is useful.** Masking (`****1234`) proves nothing about ownership, adds no search capability, and still leaks a stable 4-character correlator. Its only plausible value is as a human disambiguation hint ("is this the same account I play with?") — which requires the viewer to already know the full ID out-of-band. Usefulness is unproven in any frozen use case.
5. **Whether the platform should verify ownership.** Verification would mean asserting "this user controls this game account". G1 has no verification workflow, no evidence review path wired to game profiles, and no badge/status column. Adding a verification claim without proof repeats the exact failure `08` T9 exists to prevent.
6. **Whether verification is game-specific and technically feasible.** Identifier formats, account systems, and any publisher tooling differ per title. The frozen docs invent no BGMI/Krafton verification API and no in-client proof flow. Feasibility is therefore **unknown, not assumed**. Any per-title proof (screenshot evidence, deep-link challenge, publisher API, in-game friend-code check) needs its own threat model, reviewer workflow (D-08 adjacent), and abuse analysis. Nothing in `01–09` or `src/` evidences such a mechanism.
7. **Whether the value should be searchable.** Searchable IDs enable (a) exact-match lookup ("find the owner of ID X") and (b) duplicate/impersonation hunting. Both convert a private identifier into an oracle: anyone with an ID from in-game can probe platform membership. No frozen search input includes it (`07` DirectorySearchInput has game/region/role/query/limit/offset only). Search indexes on it do not exist (only `(game_key, region_code, primary_role)` partial + GIN on modes/availability).
8. **Whether it may be used for duplicate detection.** The schema deliberately permits duplicates because the value is unverified. Enforcing uniqueness or flagging "duplicates" would treat user-typed strings as global identity — false positives (typos, shared/clan accounts, recycled IDs) become false accusations of impersonation. The legacy `target-schema.md` `UNIQUE(game,game_user_id)` belongs to a future verified design, not G1.
9. **Whether it should appear in organization/brand recruitment workflows.** Recruiters (P2–P4) consume the masked public projection only in G1 (`01` § P2: "Views masked public projection only. No PII."). Surfacing raw or masked IDs to recruiters before an application-acceptance boundary would widen exposure to the exact audience with the strongest incentive to contact players off-platform. The frozen contact-surface rule (`04` §6: no email/social/external links in G1 projection; future `external_link` stays private until acceptance) points the same way: identifiers, like contact handles, should wait for an acceptance-gated handoff, not the directory.
10. **Whether the user can remove or change it.** Today yes: update schema accepts a new value or explicit `null` (clear). RLS UPDATE permits it while active. What is missing is product copy (is clearing disclosed? does clearing propagate to any masked cache?) and the D-G1-07 delete-flow interaction (row DELETE is not yet available; clearing the field is the only G1-3 removal path). Any future masked projection must define revocation semantics (see §7).
11. **Whether it should be stored separately from IGN.** It already is: `ign` (required, 2–30) and `game_user_id` (optional, 4–32) are separate columns with separate semantics (`03` §3/§5). Conflating them would be a regression — IGNs change freely and collide; title IDs are stable numeric-looking strings. Keep separate. No decision needed beyond affirming the current separation.
12. **Whether future integrations support different identifier types.** BGMI's numeric-looking 4–32 text is one shape. Other titles may use UUIDs, Riot-ID-style `name#tag`, SteamIDs, or short codes. The codebase already isolates per-game vocabularies behind a dispatcher (`game.ts` region dispatcher; `05` §1 per-game CHECKs). The identifier column as generic `text 4–32` is BGMI-tolerant but not universal: some titles need longer values, structured splits, or different character rules. Do not freeze a global ID regex. If collection continues, each title needs its own validation + storage note (length, alphabet, case handling), landing as a catalogue-coupled migration — the same pattern D-G1-09 established for regions.

## 5. Options comparison

Conventions: "DB changes" means additive migration work (no existing-migration edits). "Projection impact" is measured against the frozen 12 columns. "Blocks G1-4" means G1-4 cannot start/finish without this option's decision content.

### Option A — Private optional identifier (status quo persistence, no public return)

- Description: Keep `game_user_id` exactly as implemented: optional text 4–32, owner-private, returned only on own rows, never in directory RPCs (full or masked). No verification claim. No search, no dedup, no recruiter surfacing.
- User value: Low but real — owners can record their title ID for personal reference / future handoff without any public exposure.
- Privacy risk: Lowest of the collect-options. Residual: stored PII-adjacent identifier subject to breach/backups; linkable if combined with a future leak. Mitigated by RLS + least grants + no public path.
- Abuse risk: Lowest. Attacker cannot enumerate, scrape, or oracle IDs through the platform. Self-declared impersonation (claiming someone else's ID) is invisible to others, so it cannot be weaponized for trust.
- Implementation cost: Zero additional (already built + tested in G1-3).
- Future compatibility: Highest. Preserves every future path (stay private, add consented sharing, add verification, deprecate) without migration rework. Adding a masked/shared/verified layer later is additive.
- Required DB changes: None.
- Public projection impact: None (12 columns unchanged).
- Whether it blocks G1-4: No — this is the unblocking choice. G1-4 proceeds on the frozen output with an explicit "excluded" recorded.

### Option B — Optional masked sharing (owner opts specific game profiles into `****1234`)

- Description: Owner toggles per-game-profile masked visibility; directory RPCs return a derived masked string (exact spec required, e.g. legacy `**** || right(game_user_id, 4)`) alongside or instead of nothing. Full value never leaves the server on public paths.
- What "masking" must mean (if approved): a deterministic server-side derivation returning exactly 8 characters (`****` + last 4 of the stored value, preserving stored characters byte-for-byte including leading zeroes in the suffix); NULL stays NULL (never `****null`); values shorter than 4 cannot exist (CHECK floor) so no edge padding rule is needed; derivation happens inside the DEFINER RPC (never client-side); masked output requires its own consent predicate (e.g. a new `share_masked_id` flag or reuse of `is_visible` — explicitly decided, not implied).
- Residual identifiability: YES, material. Last-4 is a stable correlator: combined with `ign + game_key + region_code + play_modes` (all public), a 10k-space suffix partitions the candidate set sharply; anyone who sees the full ID in-game (teammates, opponents, stream viewers) can confirm platform membership by matching suffix; suffixes are enumerable across the directory (only 10,000 numeric suffixes — fewer with leading-zero preservation). Masking is obfuscation, not anonymization. It also creates a false-precision affordance ("`****1234` looks official") without proving ownership.
- User value: Speculative disambiguation hint for viewers who already know the full ID. No frozen recruiter/player story requires it.
- Privacy risk: Medium. Converts a private field into a public stable pseudonym for opted-in rows, with revocation/caching subtleties (see §7).
- Abuse risk: Medium. Suffix oracle enables membership confirmation, cross-leak correlation (game-leaderboard dumps ↔ platform directory), targeted harassment ("I know your suffix, I know your handle"), and impersonation setups (attacker copies victim's IGN + claims nearby suffix).
- Implementation cost: Small but non-zero — new consent flag or predicate reuse decision, RPC derivation + tests, Zod/contract updates, copy for opt-in, revocation matrix extension, key-set test update (12 → 13 columns on opted-in rows or a separate projection shape).
- Future compatibility: Moderate. Bakes a weak primitive into the public contract; removing it later is a breaking projection change. A future verified flow would likely replace masking with a badge + acceptance-gated handoff, making masking transitional at best.
- Required DB changes: At minimum a consent-signal migration (new boolean or documented reuse of `is_visible` — reuse conflates "show this game" with "show my ID suffix" and is discouraged); possibly a generated-column or RPC-only derivation (prefer RPC-only to avoid stored duplication).
- Public projection impact: Changes the frozen contract (new 13th column or conditional shape; `isPublicProjectionColumn` + `PUBLIC_PROJECTION_COLUMNS` + `12` key-set test all change). This is precisely why D-G1-04 gates G1-4.
- Whether it blocks G1-4: Yes — G1-4 cannot be built until the masked spec, consent predicate, NULL/revocation semantics, and output shape are frozen. Approving "masked, details later" does not unblock G1-4.

### Option C — Explicit verified identifier (verification status + evidence model)

- Description: Add a verification domain: `verification_status` (and supporting `verification_method`/`verified_at`/`evidence_id`-style fields), an evidence submission + reviewer flow, and a public signal (badge/boolean) that is shown **only** when proof exists. The raw ID itself may stay private even when verified (badge ≠ ID disclosure).
- Proof required (not invented here): the brief cannot specify the proof because no frozen source does. Candidate classes — each needing its own design — include publisher-verified API lookup, in-game challenge/response (e.g. add-friend or profile-code check), signed deep-link, or human reviewer adjudication of evidence uploads via the existing `private-verification` bucket + signed URLs. `02`/`04` reserve the evidence bucket and reviewer path but wire no game-profile flow to them.
- API/method reality check: no game API or reliability claim is evidenced in `01–12`, `src/`, or the G1-3 report. BGMI/Krafton publisher verification is not described in any reviewed source. Per strict constraints, this brief invents none and labels none as verified. Feasibility per title is therefore OPEN and must be proven title-by-title before any badge ships.
- User value: Highest if real — verified ownership enables trustworthy recruiter handoff and anti-impersonation. Negative if fake — an unverified "verified" label is worse than no label (`08` T9).
- Privacy risk: Medium-High during proof (evidence uploads contain screenshots/IDs; reviewer access, retention, and redaction need D-08-adjacent design). Steady-state public risk depends on design (badge-only is low; badge + raw ID is high).
- Abuse risk: High if rushed — forged screenshots, borrowed accounts, recycled IDs, reviewer social-engineering, badge-spoofing in UI (copy/paste of badge markup). Requires reviewer workflow, evidence retention policy, appeal path, and UI trust-chrome rules.
- Implementation cost: Large — new columns/migration, evidence flow, reviewer tooling/permissions, status machine (`unverified → pending → verified/rejected`), audit trail, public-signal contract, abuse monitoring. Multiple stages beyond G1.
- Future compatibility: Best long-term target, worst short-term vehicle. Do not bolt it onto G1-4.
- Required DB changes: New columns + constraints (`CHECK verified → verified_at NOT NULL`-style, writer caps like the legacy `target-schema.md` pattern — reference only, not adopted here), status-machine enforcement, evidence linkage (no-FK evidence IDs per legacy pattern or explicit FK — decided in the verification design, not here).
- Public projection impact: None in G1 (no badge column added; UI shows no badge). Future: badge/boolean only, raw ID stays out unless separately approved.
- Whether it blocks G1-4: Must NOT block G1-4. G1-4 ships unverified (no badge, no ID); verification is a post-G1 domain.

### Option D — Do not collect (deprecate field in a future additive migration)

- Description: Decide the platform will not store title identifiers. Land a future additive migration that stops writing the column (application stops accepting it; CHECK retained or relaxed per migration hygiene) and, after a retention/disclosure window, drops or nulls existing values. No new collection UI in G1-7.
- User value: Negative for the small set of owners who recorded an ID; positive for everyone as data-minimization (nothing to leak, breach, or link).
- Privacy risk: Lowest steady-state (no store = no exposure). Transitional risk: existing rows hold values until the deprecation migration lands — needs a disclosure + backfill (`UPDATE ... SET game_user_id = NULL`) plan, not silent abandonment.
- Abuse risk: Lowest (no identifier oracle of any form).
- Implementation cost: Small — Zod removal/ignore, server-operation removal, migration (additive: stop-write then drop/null), copy updates. Must not edit the G1-3 migration (history is append-only).
- Future compatibility: Reversible at a cost. Re-collecting later is a new migration + re-consent. If recruitment handoff later needs IDs, they would be collected at acceptance time (narrower, purpose-bound) rather than at profile creation — arguably the better design anyway.
- Required DB changes: One future migration ( additive deprecation; `DROP COLUMN` only after retention window and only via new migration). No G1-4 RPC work.
- Public projection impact: None (nothing was ever projected).
- Whether it blocks G1-4: No — G1-4 proceeds identically to Option A (12 columns, no ID). The deprecation migration itself is post-G1-4 work.

### Option E (additional, supported by sources) — Acceptance-gated full sharing (future, not G1)

- Description: Raw `game_user_id` is revealed only to a narrow, authorized counterparty after a mutual acceptance event (e.g. application accepted for a vacancy/opportunity), never in the directory. This mirrors the frozen `external_link` rule (`04` §6: future contact stays private until acceptance) and the `01` P2 constraint ("No DMs", "No contact details on public projections").
- Why listed: it resolves the recruiter "need the real ID" story without weakening the public contract, and it is the natural consumer if collection continues. It belongs to the opportunities/applications domain (D-09 adjacent), not G1.
- Cost/impact: No G1-4 impact. Requires a future sharing-rule design (who sees what after which event, audit trail, revocation on withdrawal). Recorded here so the owner does not approve public masking as a substitute for a narrower handoff that better fits the need.

## 6. Security and privacy analysis

- **T1 — PII leakage via over-broad reads.** Current posture is correct: RLS deny-by-default, no anon base policies, no `select *`, frozen allowlist omitting IDs/`game_user_id`/evidence/timestamps. Any masked or full inclusion re-opens T1 deliberately and must carry its own predicate + key-set test. The `12` §5 key-set test (`===` frozen columns) is the backstop — it must fail on drift.
- **T5 — Unauthorized discoverability / revocation.** Consent withdrawal is immediate in query predicates today because there is nothing ID-derived to withdraw. A masked column adds a second revocation surface: clearing `game_user_id`, toggling the share flag, toggling `is_visible`, and toggling master consent must all suppress the masked suffix on the next RPC call, and any future cache/index must filter on read or accept documented delay (`04` §4). Copy must state exactly what the share toggle exposes.
- **T8 — Enumeration.** Handle availability is accepted residual (throttled). A masked suffix adds a new enumerable dimension (10k suffix space, directory-wide scraping, suffix+IGN correlation). Throttling the directory does not fix a correlator that is returned by design. Full-ID search would be worse (exact-match oracle); it is not proposed in any option except as a rejected shape.
- **T9 — Fake verification.** The highest-severity nearby risk. `game_user_id` is self-declared text (`03` §5: "never treated as proof of account control"). Rendering it — full or masked — next to IGN/role chips invites readers to treat it as identity proof. G1 has no badge, and this brief adds none. Any UI copy must avoid "ID", "verified", checkmarks, or official styling near the value. If Option B is chosen, the UI label must read as self-reported (e.g. "ID as entered by player (unverified)") — exact copy is a G1-6/7 product task, flagged here.
- **T10 — Cached/indexed profile after revocation.** `noindex` default + opt-in indexing (`04` §4) limits search-engine persistence, but masked suffixes in OG cards, screenshots, or third-party scrapes persist. Minimizing what enters the projection minimizes blast radius — the strongest argument for Option A/D over B.
- **Data minimization (NFR-02).** Collection without a frozen consumer violates minimization. If the owner keeps collection (A/B/C-path), the brief requires a recorded purpose (personal reference now + acceptance-gated handoff later) to justify retention; otherwise D (do not collect) is the minimization-consistent choice.
- **Linkability beyond the platform.** Title IDs are stable, cross-context identifiers: they appear in-game, on streams, in leaderboard dumps, and in breach corpora. Even last-4 enables join attacks against such corpora when combined with public IGN/region. Full IDs enable direct in-game contact/harassment. This is why recruiter handoff belongs behind acceptance (Option E), not in the directory.
- **Impersonation direction.** Because the field is self-declared, anyone can type anyone else's ID. Public display (full or masked) lets an impersonator borrow credibility ("same suffix as the famous player"); private storage (A) keeps false claims invisible and harmless. Verification (C) is the only design that addresses impersonation, and only with real proof.
- **No new PII in logs.** `04` §7: no PII in application logs. Any future masked/full logging of IDs in error payloads is forbidden — domain errors stay generic (already the case in `server/game-profile.ts`).

## 7. G1-4 dependency analysis (minimum decision to unblock G1-4)

1. **G1-4 can and should proceed with the frozen 12-column projection unchanged.** The directory/search use cases in `07`/`09` (game/role/region/query/pagination) function fully without any title identifier. No frozen filter, sort, or card design references it.
2. **`game_user_id` — full and masked — must remain excluded from both G1-4 RPCs** unless the owner gives explicit, spec-level approval of Option B (exact derivation, consent predicate, NULL/revocation semantics, output shape). "Masked, details later" is not a decision G1-4 can build on.
3. **Any future masking belongs in a separate, explicitly consented projection element, not a silent 13th column.** Preferred shape if ever approved: opt-in per-game flag, RPC-side derivation, separate key-set test, separate consent copy. It must never ride on `is_visible` alone (which means "show this game", not "show my ID suffix").
4. **Public discovery does not require verification.** G1 discovery is explicitly self-declared discovery (`03` §6, `08` T9). G1-4 must ship no badge, no "verified" string, no trust chrome. Verification (Option C) is a post-G1 domain and must not gate G1-4.
5. **Consent withdrawal must suppress all ID-derived public representations.** Under Option A/D there is nothing to suppress (trivially satisfied). Under any future Option B, the G1-4 predicates must include the share flag, and clearing the value or toggling any of (master consent, per-game visibility, share flag) must remove the suffix on the next call. G1-4 tests must cover the revocation matrix for the masked shape if it exists.
6. **Search/filter works without `game_user_id`.** No search input, index, or ranking signal needs it. Do not add `WHERE game_user_id ILIKE ...`, trigram/GIN indexes on it, or exact-match lookup RPCs in G1-4. Duplicate detection on it is forbidden in G1 (unverified ⇒ duplicates allowed, `05` §1).

Minimum unblocking decision (one line the owner can approve): **"G1-4 ships the frozen 12 columns with `game_user_id` excluded in all forms; any masked/verified/sharing form is deferred to a specified future proposal."** That line is Option A-today (with D/C/E deferred, not decided).

## 8. Recommendation (technical; final decision reserved to the product owner)

- **Technical recommendation: Option A — private optional identifier, omitted from all public projections — as the G1-4-unblocking decision.** Keep collection optional, keep storage as-is, keep it owner-only, ship G1-4 on the frozen 12 columns, and defer masking (B), verification (C), removal (D), and acceptance-gated handoff (E) to explicit future proposals with concrete consumer needs.
  - Reasoning: (i) no frozen consumer needs the value publicly (`07`/`09` search works without it); (ii) masking provides no verification and leaks a stable correlator while complicating the security boundary (new predicate, new revocation surface, frozen-contract break); (iii) verification has no evidenced mechanism and must not be faked (`08` T9); (iv) removal (D) is defensible on minimization grounds but destroys the low-cost future-handoff option before recruitment workflows are designed — defer the removal call until those workflows specify whether they need IDs at acceptance time; (v) Option A preserves all future paths additively and unblocks G1-4 immediately.
- **Product decision required (not made by this brief):** the owner must explicitly choose A, B, C, D, or E-path (or a scoped combination, e.g. "A now, E later"). Silence or "approved as recommended" on the technical line still needs an explicit recorded approval naming the option.
- **Security/privacy consequences of the recommended path:** T1/T5/T8/T9/T10 posture unchanged from G1-3; no new enumerable surface; no fake-trust signal; revocation trivially correct; residual risk limited to private-store breach/backups (accepted, mitigated by RLS + least grants + generic errors + no log PII).
- **Deferred implementation work (not authorized by this brief):** G1-4 RPCs per `09` + `12` §5 (12 columns, predicates, limits, escaping, 404-equivalence, matrix tests); any share-flag migration, masked derivation, badge/evidence domain, acceptance-gated handoff, or deprecation migration — each needs its own proposal + approval and, for C/E, coordination with D-08/D-09 owners.

## 9. Exact product-owner questions (approval record)

Answer each explicitly. "Approved as recommended" must name the option letter.

1. **Projection (gates G1-4):** For `search_player_directory` + `get_player_by_handle`, do you approve (a) exclusion of `game_user_id` in all forms (full + masked) on the frozen 12 columns, or (b) inclusion of a masked suffix with the exact spec in §5-Option B? If (b), also approve the derivation string, the consent flag name and predicate, NULL semantics, and revocation copy — "masked, details later" is not accepted as approval.
2. **Collection:** Do you approve continued optional collection of `game_user_id` (4–32 text, owner-private), or do you direct future deprecation (Option D)? If deprecation, approve the retention window and whether existing values are nulled via a future migration with user disclosure.
3. **Optionality:** Do you confirm `game_user_id` stays optional for all G1 workflows (never required for profile creation, discovery, or any future G1 gate)? If any workflow should require it, name the workflow and justification.
4. **Sharing boundary:** Do you confirm no recruiter/org/brand surface in G1 receives `game_user_id` in any form, and that any future handoff waits for an application-acceptance boundary (Option E shape) with its own approval?
5. **Verification:** Do you confirm no identifier is ever labeled or styled as verified (badge, checkmark, "verified" string, official-looking mask) without a separately approved verification design with evidenced proof? If you want verification pursued, name the target title(s) and acceptable proof class so a verification proposal can be scoped (no mechanism is approved by this brief).
6. **Search/dedup:** Do you confirm `game_user_id` is never searchable, never an exact-match lookup key, and never used for duplicate/impersonation flagging in G1? If a future anti-impersonation use is wanted, approve it as a separate proposal (it requires a uniqueness/evidence re-design).
7. **Mutability:** Do you confirm owners may change or clear (`null`) their `game_user_id` at will, and that clearing removes all public derivatives (relevant only if masking is ever approved)?
8. **Cross-title future:** Do you confirm no global ID format is frozen (each future title brings its own validation/storage note via catalogue-coupled migration, per the D-G1-09 pattern), rather than locking `text 4–32` as universal?
9. **Unblock statement:** Do you approve the minimum unblocking line — "G1-4 ships the frozen 12 columns with `game_user_id` excluded in all forms; masked/verified/sharing forms are deferred" — so G1-4 can begin?

## 10. What remains blocked until approval

- **G1-4 RPC migration + `DirectoryReader`:** blocked until Q1 and Q9 are answered. On Option-A approval: build exactly the frozen 12 columns with `game_user_id` excluded; key-set test `===` 12; matrix tests per `12` §5. On Option-B approval: additionally freeze the masked spec + predicate + revocation matrix before any G1-4 code.
- **Any masked/shared/verified representation (B/C/E):** blocked until its own spec + consent + test plan is approved. No placeholder columns, no `verification_status`, no share flags, no masked helpers in G1-4.
- **Deprecation migration (D):** blocked until Q2 explicitly directs it, with retention window + disclosure copy. The G1-3 column stays authoritative until then.
- **Search/dedup/recruiter surfacing on the identifier:** blocked indefinitely in G1; each needs a separate proposal (and for verification-adjacent work, D-08 coordination; for application-adjacent work, D-09 coordination).
- **Not blocked by this decision:** G1-5 (avatar wiring, D-G1-06), G1-6 route scaffolding that consumes only the frozen projection shape via mocked readers (no real RPC data until G1-4 lands), and any non-projection G1-3 follow-ups. D-G1-05/D-G1-06/D-G1-07/D-G1-08/D-G1-10 and D-08/D-09 remain open per `10`/`11` and are not decided here.
