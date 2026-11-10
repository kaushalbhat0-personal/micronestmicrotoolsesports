# New-Platform Backend Recommendation

## New domain tables required (D-01/D-02/D-11 approved)

Foundation: `game_titles` (seed BGMI), `player_profiles`, `game_profiles` (per-title identity, masked publicly), `teams`, `team_memberships`, `organization_teams` (divisions; team has ≤1 owning org), `brands`, `brand_representatives` (scoped, verified), `opportunities` (shared core + per-type fields incl. required compensation framing per D-07 default), `applications` (one lifecycle, partial-unique active guard), `verification_submissions` (extended targets), `reports` (extended targets incl. brand/opportunity), `news_articles`, `tournaments` (editorial), `notification_queue`. Plus membership role widening (`recruiter`) and `is_org_recruiter()` + recruiter policies (adaptation, not new table).

Each ships with: PK/FK discipline (tenant CASCADE, creator RESTRICT, audit SET NULL), TEXT+CHECK value sets, masked public views (SECURITY DEFINER, minimal columns), owner/captain/rep-gated RLS copied from proven patterns, `SET search_path` + least-privilege EXECUTE on all new functions, covering indexes incl. discovery partials.

## Reuse (no new objects)

Auth/profiles linkage, orgs/members/audit/owner-guard RPCs (extended, not replaced), `platform_admins` + both audit tables + ledger, billing rails (dormant), storage buckets + path-helper convention, share-RPC and quota-RPC design patterns.

## Keep dormant (explicit non-goals for backend work)

All §5-dormant tables from the reuse matrix; legacy finder tables stay readable as pattern reference. No backfill, no drops, no seed changes until D-12/D-13 phase approvals.

## Recommended implementation sequence (blocked until P0 freeze + first migration baseline)

1. Baseline marker migration + `GameTitle` seed + `db:types` fix (D-18).
2. Player/game-profile tables + masked views + verification queue extension.
3. Team tables + memberships + captain RLS.
4. Org adaptation (recruiter role, divisions link, helper) — needs D-02 mechanism already approved ✓.
5. Opportunity + application engine (needs D-07/D-08/D-09 values per phase gates).
6. Brand tables + verification-before-publish enforcement.
7. News/tournaments/notification tables (phase-gated).
8. Storage prefixes + bucket limits; search_path hardening pass on the 8 flagged functions.

Nothing above is implemented in this phase. First migration drafts only after owner confirms the sequence.
