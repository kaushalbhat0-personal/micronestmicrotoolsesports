# G1-6 Implementation Report — Public Player Discovery Routes

## 1. Verdict

**G1-6 PASS** — `/players` + `/players/[handle]` implemented via
DirectoryReader exclusively, mocked + static-audit + route tests green
(40/40 new), full unit regression green (202/202), typecheck/Lint/build
clean, live production-server smoke verified (200/200/404 semantics, generic
404 bodies, no private data in served HTML), zero residue. No migrations, no
writes, no commits, no pushes, no deployment.

## 2. Preflight

- Repo `micronestmicrotoolsesports`, branch `new-platform`, HEAD `01893ae`
  (unchanged). Pre-existing uncommitted items preserved (`M .gitignore`,
  `?? AGENTS.md`, `?? docs/architecture/`, `?? docs/audits/`,
  `?? src/features/player-profile/`, `?? supabase/migrations/2026111000000{3..7}_*.sql`);
  nothing staged, committed or pushed.
- Routing conventions verified against the installed Next.js docs
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`):
  `params`/`searchParams` are Promises (awaited); co-located `_lib`/`_components`
  under `src/app/players/` are not routes; `typedRoutes: true` enforced
  (route types regenerated via `next typegen` after adding routes).
- No conflicting route decision: `07 §4` + `09 G1-6` already approve exactly
  `/players` + `/players/[handle]`; no teams/orgs/brands/opportunities routes added.
- Existing conventions reused: `Container`-scale max-w-5xl layout, slate design
  tokens, `SiteHeader`/`SiteFooter`, root `not-found.tsx`/`error.tsx`, skip link
  in `layout.tsx`, `Metadata` API, `revalidate` route config.
- DirectoryReader API (`searchDirectory`, `getPlayerByHandle`), Zod schemas
  (`schemas/directory.ts`, `schemas/game.ts` BGMI vocabulary) and
  fail-closed avatar resolution read before use; unchanged.
- Metadata/SEO conventions: `04 §4` (`allow_indexing` reserved, default noindex),
  `07 §4` (metadata from projection only, handle-based canonical), `08`
  (noindex default, short cache TTL). No canonical domain invented:
  `NEXT_PUBLIC_APP_URL` from `.env.example` is read optionally; canonical is
  omitted when unconfigured.
- Test setup: `npm test` excludes `*.integration.test.ts`; new tests are pure
  unit/static (no Supabase client import anywhere in the route surface, per
  `12 §7`).
- Note: the installed `architecture` skill describes a different
  (monorepo `src/server/*`) layout that does not exist in this greenfield repo;
  G1 docs (`07`/`09`/`11`) are authoritative here and were followed instead
  (thin route orchestration → DirectoryReader, presentational components as
  leaves). No domain decision was reopened.

## 3. Routes implemented

- `src/app/players/page.tsx` — thin server component: awaits `searchParams`,
  parses via `_lib/query.ts` (URL query params are the shareable filter state),
  renders shell (heading, copy, GET filter form) and streams results through
  an inner `<Suspense>` block. Server-rendered initial results; pagination
  preserves valid filters; bounded (`page` 1..42 → offset ≤ 984, inside the
  SQL OFFSET ceiling 1000); over-read of one extra row detects a next page
  without total-count queries.
- `src/app/players/_components/directory-results.tsx` — async server component
  owning the single `searchDirectory` call; inline invalid/empty/error states.
- `src/app/players/_components/directory-filters.tsx` — GET form (no JS
  required) with labelled game/region/role/query controls + Reset link.
- `src/app/players/_components/directory-pagination.tsx` — prev/next links with
  `rel`, `aria-current="page"`, disabled states; filters preserved in hrefs.
- `src/app/players/_components/player-card.tsx` / `player-avatar.tsx` —
  result cards (handle link, IGN, game/role/region/country chips, availability)
  with validated-URL avatar or labelled text fallback.
- `src/app/players/[handle]/page.tsx` — `getPlayerByHandle`; invalid syntax
  and zero rows → `notFound()`; transport failures → route error boundary.
  `revalidate = 60` (seconds-scale profile caching per `04 §4`).
- `src/app/players/[handle]/not-found.tsx` — generic "Player not found" copy
  (no existence signal, no handle echo).
- `src/components/shared/site-header.tsx` — "Discovery" placeholder span became
  a real `Players → /players` link (only header change).

Invalid parameters fail safely: malformed fields are dropped with a user-facing
notice (valid filters kept); per-game vocabulary rejections render the empty
state; transport failures render a retryable alert. No client-side
reimplementation of discovery predicates exists anywhere in the surface.

## 4. DirectoryReader integration

- Directory: `parseDirectoryQuery` → `toDirectoryInput` → `searchDirectory`.
  Route validates shape only (lengths, game-key shape, page bounds); all
  game-vocabulary semantics stay in the reader/RPC (fail closed).
- Profile: `getPlayerByHandle` directly on the raw handle (reader normalizes +
  validates); `null` → `notFound()`; `DirectoryValidationError` → `notFound()`
  (no existence oracle).
- Client: anon-safe `createClient` from `@/lib/supabase/server` (session cookie
  if present, anon otherwise). No direct `@supabase/supabase-js` import, no
  `.from()` table access, no service-role/admin/signed-URL usage in any route
  module — asserted by `routes.test.ts` static audit (walks all non-test route
  sources).
- No new RPCs, no migrations, no writes.

## 5. Public field exposure audit

- Rendered fields are exactly the frozen 12 (`handle, display_name,
avatar_url, bio, country_code, game_key, game_name, ign, primary_role,
play_modes, region_code, availability`). Card/profile components take
  `PublicPlayerCard` (compile-time frozen) and enumerate fields explicitly.
- `game_user_id` (full or masked), user IDs, email, evidence, timestamps,
  flags: absent from all components, metadata builders, served HTML and page
  source — asserted by component tests (tainted-card render), metadata tests,
  route audit (source scan incl. comments) and live smoke HTML inspection.
- No ratings, rankings, K/D, follower counts, achievements, verification
  badges or skill scores. No social feed, comments, DMs or contact actions.
- Empty optionals render explicit "Not specified" placeholders; avatar NULL
  renders a labelled text fallback (never a broken image, never a guessed URL).

## 6. SEO/metadata behavior

- `/players`: static title/description, `robots: { index: false, follow: true }`
  (no indexing opt-in exists in the frozen projection per `04 §4`).
- `/players/[handle]`: `generateMetadata` from projection only (title
  `display_name (@handle)`, bio or derived description, truncated to 160);
  invalid/missing handles get generic "Player not found" metadata with noindex —
  indistinguishable, no existence leak. `robots` noindex on all profiles.
- Canonical: handle-based (`/players/[handle]`), absolute only when
  `NEXT_PUBLIC_APP_URL` is configured (live-verified emitting the project's
  configured Vercel URL; omitted otherwise — no invented domain).
- No JSON-LD/structured data emitted (no PII surface to audit). No private
  values in metadata or page source (smoke-verified).

## 7. Accessibility and responsive findings

- Semantic HTML: `h1` per page, `h2` sections, `article` cards, `dl` game
  facts, `ul` chip lists, labelled `nav` for pagination, `role="status"` for
  result counts/notices, `role="alert"` for the error state, `role="img"` +
  `aria-label` on avatar/placeholder/skeleton.
- Keyboard: native form controls + links/buttons only; visible focus rings
  (`focus-visible:outline`) on every interactive element; skip link already in
  root layout.
- Labels: every filter control explicitly labelled (`htmlFor`/`id`); result
  links carry descriptive text (name + handle); avatar `alt`/placeholder
  labels; pagination `aria-label` + `aria-current`.
- No reliance on color alone (text labels accompany all chips/states; error
  uses text + role, not color only). Contrast inherits the existing slate-on-white
  system; amber notice pairs dark text on light background.
- Responsive/mobile: grid collapses `sm:grid-cols-2 lg:grid-cols-5` (filters),
  `md:grid-cols-2` (cards), `sm:grid-cols-2` (facts); `min-w-0` + `truncate` +
  `break-words` prevent horizontal overflow (no fixed-width content; verified
  class-level, no `overflow-x` needed).
- Loading: shell paints immediately; results region shows an announced
  skeleton (`aria-label="Loading player directory results"`).

## 8. Unit and route test results

New suite `src/app/players/` — **40/40**:

- `_lib/query.test.ts` (21): valid filters + offset derivation; game
  case/whitespace normalization; empty-string = absent; repeated-param
  first-wins; malformed game/region/role/query/page dropped with valid ones
  kept; hostile input never throws; page 0/negative/fraction/overflow/`"9999"`
  clamp to 1; max page offset ≤ 1000; reader-input mapping with +1 over-read
  and undefined omission; href filter preservation + page-1 canonical form +
  hostile-value encoding; metadata from projection only (bio + fallbacks, no
  `null`/`undefined` leaks); generic directory/not-found copy; canonical
  undefined without env, absolute handle URL with env.
- `_components/components.test.tsx` (13): avatar URL + alt, NULL fallback
  label; card link href + field chips; tainted-card `game_user_id` absence;
  NULL-field safety; filter form GET/labels/names/values/reset; pagination
  hrefs/rels/current/disabled; profile sections fields; tainted profile
  secrecy; empty-field placeholders; skeleton announcement.
- `routes.test.ts` (6): route surface exists; no `.from(`/base-table refs in
  any route module; no service-role/admin/direct-client/signed-URL; no
  `game_user_id` in any route source/comment; directory reads only via
  `searchDirectory` (page → `DirectoryResults` → reader); profile only via
  `getPlayerByHandle` + `notFound()`.

## 9. Regression results

- Full unit lane `npm test`: **202/202 across 19 files** (162 carried
  G1-1..G1-5 + 40 new). No G1-1..G1-5 test touched.
- Live smoke (production build, read-only anon RPCs, servers stopped after):
  `/players` → 200 with shell + streaming results; `?game=bgmi&region=atlantis&page=99`
  → 200 fail-safe empty state; `/players/zzz_no_such_handle_zzz` → **404**
  with generic body; `/players/ab` (bad syntax) → **404**; directory HTML
  contains canonical + robots, zero `game_user_id`/secret traces.
- Notable fix during verification: an initial shared `players/loading.tsx`
  flushed the streaming shell with status 200 before `notFound()` fired,
  pinning the missing-handle response at 200 (body was already correct).
  Removed it; loading state moved to an inner `<Suspense>` fallback inside
  the directory page only, restoring true 404s on the profile route.
- `npm run typecheck` PASS; full `npm run lint` PASS (0 errors, 0 warnings);
  `npm run build` PASS (routes: `/`, `/_not-found`, `/api/health`,
  `ƒ /players`, `ƒ /players/[handle]`; `middleware`-deprecation notice
  pre-existing). G1-1..G1-5 behavior untouched (no shared files changed except
  the one-line header link + feature README scope note).

## 10. Build and lint results

- `npm run typecheck`: PASS.
- `npm run lint` (full repo): PASS, no warnings. (`next/image unoptimized`
  used for avatars to keep `no-img-element` at zero warnings; `next typegen`
  run once to register the new routes for `typedRoutes`; helper return typed
  as `` `/players` | `/players?${string}` `` to satisfy `RouteImpl`.)
- `npm test`: 202/202 PASS.
- `npm run build`: PASS, both routes dynamic (`ƒ`), as required (searchParams
  - cookies + `revalidate`).
- Prettier: new/edited files formatted (`prettier --write`).

## 11. Files changed

New (`src/app/players/`, untracked):

- `page.tsx` — directory route (thin orchestration + Suspense).
- `[handle]/page.tsx` — profile route + `generateMetadata` + `revalidate`.
- `[handle]/not-found.tsx` — generic profile 404.
- `_lib/query.ts` — pure param parsing, reader-input mapping, href builder,
  metadata/canonical builders.
- `_lib/query.test.ts` — 21 route-boundary tests.
- `_components/directory-results.tsx` — async results block (reader call).
- `_components/results-skeleton.tsx` — streaming fallback.
- `_components/directory-filters.tsx` — GET filter form.
- `_components/directory-pagination.tsx` — filter-preserving pagination.
- `_components/player-card.tsx` — result card (projection fields only).
- `_components/player-avatar.tsx` — validated URL / labelled fallback.
- `_components/profile-sections.tsx` — profile body (projection fields only).
- `_components/components.test.tsx` — 13 presentational tests.
- `routes.test.ts` — 6 static data-path audit tests.

Modified:

- `src/components/shared/site-header.tsx` — "Discovery" span → `Players`
  link (`/players`).
- `src/features/player-profile/README.md` — scope notes (G1-6 lives in
  `src/app/players/`, reader-exclusive).

This report (`docs/architecture/g1-identity-player-profile/G1-6-implementation-report.md`).

## 12. Git status

- Branch `new-platform`, HEAD `01893ae` (unchanged).
- Modified: `M .gitignore` (pre-existing), `M src/components/shared/site-header.tsx`.
- Untracked (new): `?? src/app/players/`, plus pre-existing `?? AGENTS.md`,
  `?? docs/architecture/`, `?? docs/audits/`,
  `?? src/features/player-profile/`,
  `?? supabase/migrations/2026111000000{3,4,5,6,7}_*.sql`.
- Nothing staged, committed or pushed, per non-negotiables.

## 13. Next gate recommendation

- Proceed to **G1-7** (owner settings/consent/deletion flows; gated on
  D-G1-05/D-G1-07/D-G1-08 + public onboarding on D-G1-07/D-G1-10). No G1-7
  work started here.
- Keep the route-audit test pattern: any future route touching player data
  must import only DirectoryReader/owner-repository paths and stay covered by
  the static scan.
- Open follow-ups (not blockers): multi-game `getPlayerByHandle` (>1 row)
  fail-closed behavior carries into profile routes unchanged by design
  (single-title G1 catalogue); directory total-count UX intentionally absent
  (projection-only counts); external search-engine de-indexing remains
  best-effort per `04 §4` (noindex emitted, propagation disclosed).
