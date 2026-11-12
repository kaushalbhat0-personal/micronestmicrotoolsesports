# P1 Domain and Data Integration Notes

## Domain reuse

- Levels, roles, matching, roster-intake, search parsers, and Zod team /
  recruitment / application / report boundaries (`src/features/teams/`) are
  reused unchanged. New code only adds the public-read contract
  (`domain/team-directory*.ts`), the read-input schemas
  (`schemas/directory.ts`), and the server reader
  (`server/team-directory-reader.ts`).
- Platform identity stays game-independent: game names resolve through the
  catalogue; BGMI vocabulary is referenced, never copied, and never applied
  to other titles.

## Data integration status: CODE-COMPLETE, NOT LIVE

- The reader targets the D1 masked RPC pair exactly as specified in
  `20261112000002_d1_teams_discovery.sql` with the `20261112000003`
  remediation contract (LIKE-escaped query, limit 1..60, offset 0..1000,
  `is_public` predicate, 9 detail columns + description):
  - `search_teams(p_game, p_region, p_query, p_limit, p_offset)`
  - `get_team_by_slug(p_slug)`
- **The three D1 migrations and the D1.6.1 corrective migration remain
  local and unapplied** per phase policy (no remote application, no resets).
  Until acceptance + application, both RPCs are absent remotely and every
  team read resolves to the generic "unavailable" error state. This is the
  designed fail-safe, not a bug: no rows are fabricated to fill the gap.
- No base-table reads exist anywhere in the team route surface (static
  audit enforced). No new RPCs were created. No grants, policies, or G1
  contracts were touched.

## Integration boundary (what unlocks liveness, in order)

1. D1 migration acceptance (owner decision register D1-D1…D1-D12, technical
   blockers register) → 2. remote application by the authorized owner flow
   (explicitly NOT this phase) → 3. direct-PostgREST verification of both
   RPCs (shape, key-set, `is_public` predicate, escaping, clamps) → 4. RLS
   + RPC execution tests on a disposable replay → 5. routes go live with no
   code change (the reader already targets the accepted contract).

## Deliberately unwired

| Capability | Why not wired |
| --- | --- |
| Team insert/update | D1-D3 (captain authority) + D1-D10 (ownership) undecided; writes stay disabled rather than faked |
| Roster identities | Member-private under D1 RLS; no public RPC exists; count-only display |
| Recruitment post feed | No public RPC; base reads are member-gated |
| Application insert/withdraw | D1-D3/D1-D12 pending; insert boundary (F-NEW-01) verified statically only |
| Captain decisions, roster auto-insert, ownership transfer | Blocked (D1-D3, D1-D10, D1-D12); no RPC invented |
| Team logos | No D1 column or storage bucket; initial-letter mark only |
| Server-side recruiting/role filter | RPC exposes neither parameter; display-only in P1 |
