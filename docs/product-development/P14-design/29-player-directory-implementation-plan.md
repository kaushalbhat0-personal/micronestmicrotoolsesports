# 29 — Player Directory Implementation Plan (P14-B4 Phase 1)

## 1. Preflight state

- Branch `new-platform`, HEAD `376df8f`; all pre-existing uncommitted changes
  preserved (no stash, no reset, no checkout).
- Homepage baseline P14-B3 PASS: 1004 unit tests, 3 E2E, typecheck/lint/build
  green. Stitch reference: project `7199013429647347145`, screen “MicroNest
  Esports - Player Directory” (HTML 51,971 chars via Stitch MCP
  `download_file`; no local DESIGN.md/code.html in repo).
- Tokens/motion: homepage Competitive Arena system (`globals.css` carbon /
  steel / slate / crimson, Oswald + Geist, 0px radii, reduced-motion guard)
  is the source of truth — no new theme.

## 2. Current `/players` implementation

- `page.tsx` — thin orchestration: parse query → shell (h1 “Player
  directory”, copy) → `DirectoryFilters` → invalid-notice → Suspense
  `DirectoryResults`. Metadata static + noindex, canonical when configured.
- `_lib/query.ts` — frozen boundary: filters `game | region | role |
  query` + `page` (1..42, size 24, +1 over-read for `hasMore`).
  `buildDirectoryHref` preserves valid filters; page 1 omits `page`.
- `DirectoryFilters` — server GET form, controls from real vocabularies
  (`bgmi` only; `BGMI_REGION_VOCABULARY`; `BGMI_ROLES`), Apply + Reset.
- `DirectoryPagination` — Prev/Next + “Page N”, `rel` attrs, no totals.
- `DirectoryResults` — invalid / unavailable (`role=alert`) / empty states
  + honest “Showing N … page P” slice count + 2-col grid.
- `PlayerCard` — frozen projection fields only, link `/players/${handle}`,
  avatar with labelled fallback; `ResultsSkeleton` with loading label.
- `[handle]/page.tsx` — profile via `getPlayerByHandle` only,
  404-equivalence, `revalidate = 60`. Profile-link contract:
  `/players/${card.handle}`.

## 3. G1 contract (frozen — no changes)

- Projection (12, fixed order): handle, display_name, avatar_url, bio,
  country_code, game_key, game_name, ign, primary_role, play_modes,
  region_code, availability. No `updated_at`, no identifiers, no email, no
  timestamps (`domain/directory.ts` + compile-time key guards + runtime
  projection tests).
- Reader: `DirectoryReader.searchDirectory` (APPROVED D-G1-03 RPC-only) is
  the sole data path; per-game vocab enforced fail-closed inside reader/RPC.
- Catalogue: only `bgmi` selectable (`mlbb` planned → rejected, never an
  option). BGMI roles IGL/Assaulter/Support/Scout; regions
  india/asia/europe/north-america/south-america/middle-east/online; modes
  squad/duo/solo/tpp/fpp (display only); availability shape-only.
- `routes.test.ts` statically audits the whole `src/app/players` tree: no
  `.from(`, no base-table refs, no service role, no `game_user_id` even in
  comments. New files must stay comment-clean too.

## 4. Stitch extraction → production mapping

| Stitch element | Production decision |
|---|---|
| Eyebrow PLAYER DISCOVERY, H1 DISCOVER ESPORTS PLAYERS, opt-in copy | Arena intro band; copy from real positioning; trust line rewritten truthfully + `/about` link |
| Search + 5 labelled selects + APPLY/CLEAR ALL | Keep GET architecture, restyle Arena; selects only game/region/role (reader-supported); no format/availability filters |
| Active filter chips with close | NEW `active-filters.tsx`: per-filter remove links via `buildDirectoryHref` minus one filter + Clear all; server-rendered |
| Mobile filter panel | NEW `filter-panel.tsx` client disclosure (SiteHeader pattern: `aria-expanded/controls`, Escape closes, closes on submit); form stays uncontrolled server-rendered children |
| Sort (Recently Updated / A–Z / status) | OMIT — projection has no `updated_at`; no approved sort contract; no decorative control |
| Numbered pages 01/02/03 | KEEP Prev/Next + Page N (no totals exist) |
| 4 specimen cards (IDs, VERIFIED EMAIL, quotes) | NEVER seed/display; cards render reader rows only; empty state otherwise |
| VERIFIED EMAIL / EMAIL REACHABLE / crypto / decentralized / zero-latency / verified-DB claims | STRIPPED; concise privacy note: opt-in only, self-declared, no identity/skill verification |
| Consent/Data-mandate/Terms/Privacy/Reports/Leaderboards/Archive/Telemetry links (`href="#"`) | DROPPED; only `/players`, `/players/[handle]`, `/about` |
| Future games (Valorant/CS2), circuits (N/W/S/E), Sniper/Flex roles, format/status vocabularies | NOT exposed; only catalogue/vocab values |
| Footer chrome | Untouched shared footer |

## 5. Files to change / create

- Modify: `page.tsx` (intro band + trust note + `<ActiveFilters/>`,
  orchestration stays thin), `directory-filters.tsx` (Arena restyle, same
  fields/architecture), `player-card.tsx` (Arena hierarchy + bio excerpt +
  View Profile, same data/link contract), `directory-results.tsx`
  (Arena states, same branches), `results-skeleton.tsx` (sharp skeleton),
  `player-avatar.tsx` (sharp geometry only), `components.test.tsx`
  (extend: chips, fallbacks, no-dead-hrefs, no-trust-claims, disclosure).
- Create: `_components/active-filters.tsx`, `_components/filter-panel.tsx`,
  `e2e/players.spec.ts` (shell/controls/no-dead-links smoke).
- Frozen (no touch): `_lib/query.ts`, reader, schemas, catalogue,
  projection, `[handle]`, routes/table contracts.

## 6. Risks

- `routes.test.ts` scans new files: keep them free of `.from(`,
  table names, `game_user_id` (even in comments).
- Client disclosure must degrade like the header pattern; no-JS mobile
  tradeoff documented in doc 32.
