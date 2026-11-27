# 33 — Player Directory Test Evidence (P14-B4 Phase 7)

No existing test weakened: all prior assertions kept verbatim; only
additions. Frozen contracts (`_lib/query.ts`, reader, schemas, catalogue,
projection, profile route) untouched — covered by unchanged suites.

## Unit (Vitest)

- `src/app/players/_components/components.test.tsx`: 13 → 21 tests (+8).
  New: card renders modes/availability/bio excerpt/profile action with
  handle-specific `aria-label`; empty-optionals omission; no dead hrefs and
  no trust/telemetry vocabulary in card HTML; filter vocabulary allowlist
  (no format/availability/status/sort names, no mlbb/Valorant); ActiveFilters
  remove-href preservation (minus-one-filter URLs), clear-all, null render
  when inactive; FilterPanel disclosure semantics (`aria-expanded`,
  `aria-controls`, hidden, active-count label).
- `src/app/players/routes.test.tsx` (6): passes — new `_components` files
  scanned clean (no `.from(`, no table refs, no service role, no
  `game_user_id` even in comments).
- `src/app/players/_lib/query.test.tsx` (21): passes unchanged — query
  boundary frozen.
- `src/features/player-profile/*` (projection, directory-reader,
  public-projection, handle, avatar, consent, visibility, game, profile):
  all pass unchanged — data contract preserved.
- Full suite: **99 files / 1012 passed** (baseline 1004 + 8 new).

## E2E (Playwright, `e2e/players.spec.ts`, 6 tests — new file)

Shell render (h1, search, Apply, opt-in copy), zero `href="#"`, invalid
`?page=999` notice naming `page`, search round-trip (apply → chip appears →
remove chip → param/chip gone), honest-state resolution (populated count OR
“No players found” OR “Directory unavailable”), mobile disclosure
open/close/Escape. All 6 pass (Chromium, vs dev server).

## Coverage map vs brief items

1. Data contract unchanged — projection + reader + query + routes suites green
2. Projection exact — `public-projection.test.ts` + compile-time key guards
3. No private fields — card/profile taint tests (incl. `game_user_id`, email, ids, timestamps)
4. Real reader data — `DirectoryResults` still `searchDirectory`-only (routes audit)
5. Optional fallbacks — null/empty card + profile placeholder tests
6. Search — unit (labels/names/preservation) + E2E round-trip
7. Filters — unit (vocab allowlist) + E2E apply
8. Individual removal — unit (minus-one URLs) + E2E chip click
9. Clear filters — unit + empty-state action
10. Pagination — preserved-filter prev/next unit tests, no totals anywhere
11. Empty state — honest copy + clear/about actions (E2E resolves honestly)
12. Loading — skeleton label test, no stream claims
13. Unavailable/error — `role=alert` retry branch (unit structure + E2E honest-state)
14. Profile links — handle-route href + aria-label unit tests
15. No dead hrefs — unit (card/filters/chips) + E2E page-wide `a[href="#"] == 0`
16. No invented metrics/claims — unit (card/prototype-vocab bans) + empty-state honesty
17. Mobile filter behavior — disclosure unit + E2E open/Escape
18. Keyboard a11y — native controls + focus management + labelled regions (unit + E2E)
