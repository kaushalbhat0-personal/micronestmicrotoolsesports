# P1 Remaining Decisions, Integration Blockers, Next Phase

## Unresolved owner decisions (all in `docs/product-discovery/D1.6-owner-decisions/`)

P1 is intentionally independent of every open decision — nothing below
blocks the shipped presentation slice, but each blocks the named liveness
step:

| Decision | Blocks | P1 posture |
| --- | --- | --- |
| D1-D3 captain authority (+ permission matrix) | Recruitment post writes, application decisions, team updates | UI complete, writes disabled |
| D1-D10 ownership transfer / interim admin | Team updates, stranded-team story | Writes disabled, no transfer RPC invented |
| D1-D12 recruitment lifecycle + privacy contract | Post feed, application writes, roster visibility | Presentation-only components, private-by-default |
| D1-D2 one-game-per-team confirmation | Live team creation semantics | Form is single-`gameKey`, matches schema |
| D1-D6 tiers as self-reported | Level copy | "Self-reported" labelling shipped everywhere |
| D1-D9 report retention/visibility | Reports UX | Not built in P1 (no report surface added) |
| D1-D4 org ownership, D1-D5 vocabulary detail, D1-D7 verification, D1-D8 availability caps, D1-D11 billing | Future slices | Untouched; `organization_id` never read |

Technical blockers register (`07-technical-blockers-separate-register.md`):
F-NEW-01 insert-boundary fix is migration-side (ships with the corrective
migration); the P1 reader assumes the remediated `search_teams` contract
(escaping, clamps) and the reader tests pin the client-visible half.

## Integration blockers (pre-liveness gate, in order)

1. Owner acceptance of the D1 migration sequence (+ D1.6.1 corrective).
2. Remote application by the authorized owner flow (never from this phase).
3. Direct-PostgREST verification: both RPCs (key-sets, `is_public`
   predicate, LIKE-escaping with `%_\\` probes, limit/offset clamps,
   anon + authenticated callers).
4. Cross-user isolation + RLS/RPC execution tests on disposable replay.
5. Re-record `05-test-evidence.md` live-render table with real rows;
   re-verify 360px/1280px layouts.
6. Marketing follow-up: homepage `RoadmapStrip` still lists Teams as
   "Planned" and the footer availability copy still says teams are planned.
   Reword only after liveness (never sell unshipped domains).

## Recommended next implementation phase (P2)

**P2 — Team creation goes live (gated):** after (1)–(4) above plus D1-D3
and D1-D10 approval, enable the `/teams/new` server operation (session-
derived `owner_user_id`/`created_by`, active-account guard), owner-visible
management of the D1-editable columns only (name, description, levels,
recruiting, visibility, region), and the immutable-column trigger behavior
verified end-to-end. Keep recruitment writes for P3 (needs D1-D12 +
captain-decision RPC design). P2 must add: operation-layer authorization
tests, RLS execution tests for team insert/update as owner / non-owner /
suspended / anon, and E2E for the creation flow. No new games in P2
(catalogue freeze holds).
