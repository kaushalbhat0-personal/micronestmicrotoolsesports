# 10 — Evidence Register

Audit HEAD: `890e16cbab0ecc03c2e562e9fe18915bca5e9eff` (`new-platform`).  
Classifications refer to inspected new-platform sources (not `legacy/` runtime).

## Git / baseline

| Evidence | Path / command |
|---|---|
| Branch / HEAD / remotes | `git status -sb`, `git rev-parse` |
| Scripts / deps | `package.json` |
| Env names | `.env.example`, `src/lib/env.ts`, `src/server/env.ts` |
| Tokens / fonts | `src/app/globals.css`, `src/app/layout.tsx` |

## Routes & navigation

| Evidence | Path |
|---|---|
| Home / OG omit images | `src/app/page.tsx` |
| About OG | `src/app/about/page.tsx` |
| Sitemap marketing-only | `src/app/sitemap.ts` |
| Header / footer | `src/components/shared/site-header.tsx`, `site-header-shell.tsx`, `site-footer.tsx` |
| Auth | `src/app/signup/*`, `login/*`, `forgot-password/*`, `auth/callback/route.ts`, `logout/route.ts` |
| Onboarding | `src/app/onboarding/profile/*` |
| Settings | `src/app/settings/profile/*` |

## Tools

| Evidence | Path |
|---|---|
| Catalog | `src/features/tools/catalog.ts` |
| Prize engine/schema/tests | `src/features/tools/prize-pool/*` |
| Roster engine/schema/tests | `src/features/tools/roster/*` |
| Tiebreak engine/schema/tests | `src/features/tools/tiebreak/*` |
| Runners | `src/app/tools/[slug]/_components/{prize-pool,roster-builder,tiebreak}-runner.tsx` |
| Directory / parity tests | `src/app/tools/page.tsx`, `routes.test.ts`, `catalog.test.ts` |
| CSV helpers | `src/features/teams/roster/output.ts` |

## Players

| Evidence | Path |
|---|---|
| Access policy / onboarding status | `src/features/player-profile/domain/access-policy.ts`, `onboarding-status.ts` |
| Directory card | `src/app/players/_components/player-card.tsx` |
| Filters | `src/app/players/_components/directory-filters.tsx`, `_lib/query.ts` |
| Public RPCs | `supabase/migrations/20261110000007_g1_public_projection.sql` |
| Game catalogue migration | `supabase/migrations/20261110000006_g1_game_catalogue.sql` |

## Teams

| Evidence | Path |
|---|---|
| Team card / recruiting | `src/app/teams/_components/team-card.tsx` |
| Create soft gate | `src/app/teams/new/page.tsx` |
| Schemas / matching / recruitment Zod | `src/features/teams/schemas/team.ts`, `domain/matching.ts` |
| Security boundary (no open-slot table) | `src/features/teams/tests/team-security-boundary.test.ts` |
| Public RPCs / mutations / grants | `supabase/migrations/20261114000004_*.sql`, `20261114000005_*.sql`, `20261115000001_*.sql` |
| Workspace writes flag | `src/features/teams/domain/workspace.ts` |

## Share / OG / rate limit

| Evidence | Path |
|---|---|
| Clipboard exports | tool runners (clipboard.writeText) |
| No PNG deps | `package.json` dependencies list |
| OG without images | `src/app/page.tsx` comments |
| Rate limit absence | grep across `src` (handle README notes only) |
| Legacy share (reference only) | `legacy/application/src/app/share/*` |

## Partial domains

| Evidence | Path |
|---|---|
| News writes disabled | `src/features/news/server/article-writer.ts` (flag pattern) |
| Brands/orgs readers without migrations | `src/features/brands/*`, `src/features/organizations/*` |
| Prior tools docs | `docs/product-development/P5-esports-tools/*` |
| Auth acceptance / Auth UNVERIFIED | `docs/product-development/P14-D14-onboarding-acceptance/02-*.md`, `08-*.md` |
| Teams contracts | `docs/product-development/P14-D1-teams/*` … `P14-D8-integration/*` |

## Tests cited

| Suite | Role |
|---|---|
| `src/features/tools/**/tests/*` | Engine correctness |
| `src/app/tools/routes.test.ts` | Catalog/runner isolation |
| `src/features/teams/tests/team-security-boundary.test.ts` | Recruitment absence |
| `src/lib/auth/redirect.test.ts` | Safe redirects |
| Player-profile / teams unit tests | Domain honesty |

## Unknowns requiring later verification

| Unknown | Why |
|---|---|
| Production Auth confirm-email / Site URL / allowlist | Management API token invalid in P14-D14 |
| Production apply state for every organizer/tournament migration | Repo has SQL; live apply not re-inspected this audit (read-only, no DB connect) |
| WCAG contrast computations | Needs browser tooling |
| PMGC 2026 official rules/dates/IP | External primary sources |
| Whether product `noindex` should change for growth | Product decision |

## Audit process note

Exploration used repository inspection and parallel read-only codebase surveys. No application files were modified; only this documentation directory was created.
