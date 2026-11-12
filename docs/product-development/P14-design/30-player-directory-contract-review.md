# 30 — Player Directory Contract Review (P14-B4 Phase 3)

## Frozen public projection — unchanged

The 12 G1 columns and their order are byte-identical to the P14-B3 baseline:

handle, display_name, avatar_url, bio, country_code, game_key, game_name,
ign, primary_role, play_modes, region_code, availability

Evidence:
- `src/features/player-profile/domain/directory.ts:10-23` — `PublicPlayerCard`
  interface untouched; compile-time `Missing`/`Extra` key guards intact.
- `src/features/player-profile/tests/public-projection.test.ts` — passes
  (key-set equality incl. column order).
- `src/app/players/routes.test.ts` — passes: no `.from(`, no base-table refs,
  no service role, no `game_user_id` in any route source or comment (covers
  the two new `_components` files via directory walk).

## What was NOT touched

- `_lib/query.ts` — filter vocabulary (`game | region | role | query`),
  page bounds (1..42, size 24, +1 over-read), `buildDirectoryHref` all frozen.
- `server/directory-reader.ts`, `schemas/`, `game.ts` vocabularies,
  `lib/game-catalog/catalog.ts` (bgmi only; mlbb planned, never selectable).
- `[handle]/page.tsx` — profile contract `/players/${handle}`,
  404-equivalence, `revalidate = 60` intact.

## Prototype elements rejected with rationale

| Stitch element | Disposition | Reason (contract ref) |
|---|---|---|
| VERIFIED EMAIL badges, EMAIL REACHABLE labels | Removed | Email is an account eligibility condition, never a public credential; projection has no email |
| “Verified athletes”, signed opt-in / cryptographic consent / decentralized nodes / zero-latency feeds / verified operational DB | Removed | Imply verification the platform does not perform; directory is self-declared by design |
| 4 specimen records (IDs, quotes, stats) | Never seeded/displayed/displayable — no fixture path exists | Real reader rows only; empty state otherwise |
| Sort (Recently Updated / A–Z / status) | Omitted | Projection has no `updated_at`; no approved sort contract; no invented timestamps |
| Numbered pages 01/02/03 + totals | Kept Prev/Next + Page N | Totals not exposed by design (over-read `hasMore` only) |
| Format + availability filters | Omitted as URL filters | Reader accepts game/region/role/query only; modes/availability render from projection |
| Future games, circuits, Sniper/Flex roles, format/status vocabularies | Not offered | Only catalogue/vocabulary values (`bgmi`; 7 regions; IGL/Assaulter/Support/Scout) |
| All `href="#"` (consent architecture, mandates, terms, privacy, reports, leaderboards, archive, telemetry) | Dropped; only `/players`, `/players/[handle]`, `/about` ship | No dead routes invented |

## Result

`/players` renders the approved composition on the frozen G1 data path.
No second data architecture introduced; no private field reachable from any
rendered component (taint tests pass).
