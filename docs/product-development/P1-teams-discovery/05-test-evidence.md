# P1 Test Evidence

## Unit + component (vitest, node env)

Full suite (`npm test`, integration excluded per repo workflow):

- **39 files passed, 407 tests passed, 0 failed.**
- New P1 coverage: **59 tests** across 4 files —
  `team-directory-reader.test.ts` (12), `query.test.ts` (21),
  `components.test.tsx` (19), `routes.test.ts` (7).
- Pre-existing D1/G1 boundary suites all green, notably
  `team-security-boundary.test.ts` (18), `application-insert-boundary.test.ts`
  (5), `multititle-contract.test.ts` (8), `teams-domain.test.ts` (8), and the
  player `routes.test.ts` (6) — no regressions.

## Static verification

- `npm run typecheck` — clean (strict mode; typedRoutes satisfied for
  `/teams`, `/teams/[slug]`, `/teams/new` after route-type generation).
- `npm run lint` — clean.
- `npm run build` — clean production build; route table confirms
  `/teams` (dynamic), `/teams/[slug]` (dynamic), `/teams/new` (static).

## Route audit (ships as tests, runs every suite)

`src/app/teams/routes.test.ts` statically asserts over all non-test team
route sources: reader-only data path, no base-table refs, no service-role,
no owner/applicant/decision tokens, no server actions or mutations.

## Live render evidence (dev server, pre-migration)

With D1 migrations unapplied, the honest pre-liveness behavior is
(verified live on a dev server, 2026-11-11):

| URL | Expected | Observed |
| --- | --- | --- |
| `/teams` | 200, shell + filters + "Team directory unavailable" error state | 200, "Team directory", "Filter teams", "Team directory unavailable", nav "Discover teams" — all present |
| `/teams?game=bgmi&region=india` | 200, same shell, filters preserved | 200 |
| `/teams/nova-esports` | Generic error boundary (missing RPC → operation error, same pattern as G1 transport failures); never an existence signal | 500 via `TeamDirectoryOperationError` ("Could not load the team directory. Please retry.", digest only, no PostgREST detail); production `error.tsx` renders generic "Something went wrong" |
| `/teams/new` | 200, full form, disabled submit + boundary notice | 200, "Create a team", "Create team (unavailable)", "saving is disabled in this phase", slug hint — all present |

## Not run (out of phase scope)

- Integration tests (`*.integration.test.ts`) — excluded per repo default;
  live-DB RLS/RPC execution requires the disposable-replay gate after
  migration acceptance.
- E2E (Playwright) — no new specs added; static-markup component tests
  cover the rendered contracts.

## Layout evidence (desktop + mobile)

- No screenshot tooling exists in this execution environment; evidence is
  structural. Every P1 surface uses the same responsive system as the
  inspected `/players` routes: single-column mobile base, `sm:grid-cols-2`
  filters/forms/detail grids, `md:grid-cols-2` result cards,
  `lg:grid-cols-4` team filters, `max-w-5xl` (directory/detail) /
  `max-w-3xl` (creation) containers with `px-4 sm:px-6` gutters, and
  `truncate`/`min-w-0` guards on identity rows.
- Verified live: all four route URLs return the expected status/body
  markers above; header/footer "Discover teams" links render in the
  `/teams` response. Post-migration, re-verify with real rows at 360px and
  1280px viewports.
