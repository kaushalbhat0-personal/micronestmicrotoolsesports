# P15-M1-V — Share Kit Visual & Functional Acceptance

**Branch:** `new-platform`  
**HEAD:** `890e16c` (unchanged; Share Kit remains uncommitted)  
**Mode:** Verification-only with in-scope defect fixes  
**Production:** untouched (no deploy / push / commit)

## Verdict

**CONDITIONAL PASS**

Core Share Kit flows pass in Chromium at desktop and mobile viewports. All exported Arena PNGs are **1080×1080**. Privacy boundaries held (no email / UUID / `game_user_id` in player or team cards). Three in-scope defects were found and fixed. Remaining gaps are non-blocking matrix coverage and known M1 limitations (not security or data-contract breaks).

## Browser & environment

| Item | Value |
|---|---|
| Browser | Playwright Chromium |
| Desktop viewport | 1440×900 |
| Mobile viewport | 390×844 |
| Base URL | `http://localhost:3000` (Playwright webServer) |
| Font probe | `--font-display` → `"Oswald"`; `document.fonts.check` ready |
| DPR | 1 (desktop Chromium) |
| Esports Supabase | `knniommcyyhbyiwljisk` (service role used only for disposable fixture cleanup) |

Acceptance driver: `e2e/p15m1-share-kit-acceptance.spec.ts`  
Machine summary: `evidence/acceptance-meta.json`

## Test matrix

### Tool exports

| Case | Result | Notes |
|---|---|---|
| Prize Pool — valid distribution + PNG download | **PASS** | Filename `prize-pool-*.png`; watermark + tool URL; calculator remains usable |
| Prize Pool — unallocated visible after calc | **PASS** | Shown in UI before export |
| Prize Pool — over-allocation error | **PASS** | Inline “Check these fields” + exceed message; no navigation away |
| Prize Pool — clipboard summary | **PASS** | Copy summary control exercised |
| Roster — empty PNG | **PASS** | All slots `<empty>` |
| Roster — partial PNG (2 starters assigned) | **PASS** | After fix: names in S1/S2; Players `2 (2 assigned · 0 bench)` |
| Roster — CSV still works | **PASS** | “CSV downloaded” status |
| Tie-Break — PNG with tied teams | **PASS** | Both `#1 … [Q]`; disclaimer denies official PMGC result |
| Mobile prize PNG export | **PASS** | Same 1080² blob from 390px UI; no horizontal overflow on campaign |

Complete-roster PNG was not saved as a separate evidence file (partial + empty covered; completeness logic unit-tested).

### Player card

| Case | Result | Notes |
|---|---|---|
| Undiscoverable → 404 | **PASS** | Before consent |
| Discoverable + long display name / IGN | **PASS** | Share card heading + PNG |
| Null avatar | **PASS** | No avatar painted (M1 design); mark/text only |
| Private fields absent | **PASS** | Image shows handle, IGN, game, role, region, modes only — no email/UUID/`game_user_id` |
| Fake handle | **PASS** | Generic not-found |

Missing-optional sparse profile was not a separate fixture; public projection fields remain the only inputs to the card model (unit-covered).

### Team card

| Case | Result | Notes |
|---|---|---|
| Recruiting enabled + public | **PASS** | “Open to Recruitment”; members count only |
| No roster identities | **PASS** | Disclaimer + no names in PNG |
| Long team name | **PASS** | “P15M1V Acceptance Wolves” |

Recruiting-disabled PNG not separately captured this run (card model unit-tested for both states).

### BGMI Season Toolkit

| Case | Result | Notes |
|---|---|---|
| Links present | **PASS** | Prize / roster / tie-break / players / teams |
| No PMGC affiliation claim | **PASS** | “not affiliated” present; no “official pmgc” |
| Mobile layout | **PASS** | Full-page screenshot; no horizontal overflow |
| `noindex` metadata | **PASS** | Unit/page metadata `{ index: false, follow: true }` |

### Canvas-specific

| Check | Result |
|---|---|
| Font readiness before draw | **PASS** (`Oswald` ready via CSS var resolution) |
| Export resolution | **PASS** (all Arena exports 1080×1080) |
| Text wrapping / clipping | **PASS** after eyebrow spacing fix |
| Long titles | **PASS** (player display name) |
| Missing image handling | **PASS** (no avatar paint path) |
| Blob download + filename | **PASS** |
| Error feedback path | Covered by unit/`ShareRenderError` (not forced in browser this run) |
| Social preview readability (~scaled) | **PASS** for dense cards; large title/rows remain legible |

## Sample output dimensions

| File | Width | Height | Bytes (approx.) |
|---|---:|---:|---:|
| `prize-pool.png` | 1080 | 1080 | 103 386 |
| `roster-empty.png` | 1080 | 1080 | 118 793 |
| `roster-partial.png` | 1080 | 1080 | 123 706 |
| `tiebreak.png` | 1080 | 1080 | 119 298 |
| `prize-pool-mobile-export.png` | 1080 | 1080 | 103 386 |
| `player-card.png` | 1080 | 1080 | 137 562 |
| `team-recruiting.png` | 1080 | 1080 | 131 417 |

Page screenshots (viewport-dependent heights): `campaign-desktop.png`, `campaign-mobile.png`, `prize-pool-desktop.png`, `prize-pool-mobile.png`, `roster-desktop.png`, `tiebreak-desktop.png`, `player-profile-desktop.png`, `team-profile-desktop.png`.

## Evidence index

All under `docs/product-development/P15-M1-share-kit-v1/evidence/`:

| File | Purpose |
|---|---|
| `prize-pool.png` | Tool export — valid INR split |
| `roster-empty.png` / `roster-partial.png` | Empty + partial roster exports |
| `tiebreak.png` | Tied standings export |
| `player-card.png` | Discoverable player share PNG |
| `team-recruiting.png` | Public recruiting team share PNG |
| `campaign-desktop.png` / `campaign-mobile.png` | Campaign page screenshots |
| `prize-pool-mobile.png` / `prize-pool-mobile-export.png` | Mobile UI + PNG |
| `*-desktop.png` (tools/player/team) | Context screenshots |
| `acceptance-meta.json` | Automated finding + size dump |

Fixture data uses clearly labeled `P15M1V` / `p15m1v_*` names only — no real private user data.

## Defects found and fixed (P15-M1 scope)

| Severity | Defect | Fix |
|---|---|---|
| **MAJOR** | Public player/team pages used `revalidate = 60`, so post-consent Share Kit still served 404 for up to a minute | `dynamic = "force-dynamic"` on `/players/[handle]` and `/teams/[slug]` |
| **MAJOR** | Roster PNG showed `Players: 2` with all slots `<empty>` when players sat on bench; partial acceptance also defaulted Place-in to bench | Share model lists Bench + assigned/bench counts; acceptance assigns starter slots |
| **MINOR** | Eyebrow/title collision (Oswald alphabetic metrics) | Extra vertical gap after eyebrow in `src/lib/share-kit/render.ts` |
| **MINOR** | Prize Pool module-level `nextId` caused SSR/client hydration mismatch | `useRef` counter scoped to component |

No database, RLS, RPC, Auth, or dependency changes were required for these fixes.

## Regression gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` (unit, 1050 tests) | PASS |
| `npm run build` | PASS |
| Playwright `e2e/p15m1-share-kit-acceptance.spec.ts` | PASS |
| `package.json` / lockfile | unchanged |
| `supabase/` migrations | unchanged |
| Production deploy | not performed |

## Remaining limitations

1. Tool destination URLs in local evidence show `localhost:3000/...` (runtime host). Player/team cards use configured public host when available.
2. Avatar still not painted on PNG (CORS/tainted-canvas avoidance — see `05-known-limitations.md`).
3. Recruiting-disabled and complete-roster states rely on unit coverage + model logic; no dedicated evidence PNGs this run.
4. Unicode / unusual-character stress not exhaustively browser-tested.
5. DPR>1 retina devices not separately exercised (canvas path multiplies by `devicePixelRatio` in renderer).
6. Disposable fixture cleanup requires confirmed email for `create_team`; acceptance confirms via admin API for the test user only.

## Final note

Stop for review. Worktree remains dirty with Share Kit + acceptance artifacts; **do not commit / push / deploy** until explicitly requested.
