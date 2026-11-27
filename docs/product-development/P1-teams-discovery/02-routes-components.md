# P1 Route and Component Inventory

## Routes (all `noindex`, canonical via `NEXT_PUBLIC_APP_URL` only)

| Route | File | Type | Data path |
| --- | --- | --- | --- |
| `/teams` | `src/app/teams/page.tsx` | Dynamic (searchParams) | Shell only; streams `TeamResults` |
| `/teams/[slug]` | `src/app/teams/[slug]/page.tsx` | Dynamic, `revalidate = 60` | `getTeamBySlug` only; `notFound()` on null/invalid |
| `/teams/new` | `src/app/teams/new/page.tsx` | Static | None (validation UI only, no fetch, no action) |

## Route support modules

| File | Responsibility |
| --- | --- |
| `src/app/teams/_lib/query.ts` | `parseTeamsQuery`, `toTeamSearchInput`, `buildTeamsHref`, metadata builders, canonical helpers; `TEAMS_PAGE_SIZE = 24`, `TEAMS_MAX_PAGE = 42` |

## Components (`src/app/teams/_components/`)

| Component | File | Functional / presentation-only |
| --- | --- | --- |
| `TeamFilters` | `team-filters.tsx` | Functional shell (GET form, shareable URLs) |
| `TeamCard` (+ `TeamAvatar`) | `team-card.tsx` | Functional presentation of live cards |
| `TeamResults` | `team-results.tsx` | Functional (async RPC block, empty/error states) |
| `TeamsPagination` | `teams-pagination.tsx` | Functional (filter-preserving prev/next) |
| `TeamsResultsSkeleton` | `results-skeleton.tsx` | Functional (streaming fallback) |
| `TeamProfileSections` | `team-profile-sections.tsx` | Functional presentation of live detail |
| `TeamForm` | `team-form.tsx` | Presentation-only (no action, disabled submit) |
| `RecruitmentPostCard` | `recruitment-post-card.tsx` | Presentation-only (prop-fed, no feed) |
| `ApplicationForm` | `application-form.tsx` | Presentation-only (no action, disabled submit) |
| `ApplicationStatus` | `application-status.tsx` | Presentation-only (empty state default) |

## Domain / server modules (`src/features/teams/`)

| File | Responsibility |
| --- | --- |
| `domain/team-directory-columns.ts` | 9-column public contract (logic-free) |
| `domain/team-directory.ts` | `PublicTeamCard`, `PublicTeamDetail`, domain errors |
| `schemas/directory.ts` | `searchTeamsInputSchema` (limit 1..60, offset 0..1000), `getTeamBySlugInputSchema` |
| `server/team-directory-reader.ts` | `searchTeams`, `getTeamBySlug`, `validateTeamRoleForGame` — the sole public team data path |

Reused without modification: `domain/levels.ts` (`SELF_REPORTED_LEVEL_NOTE`),
`domain/roles.ts`, `schemas/team.ts` (creation/application/post boundaries),
`features/player-profile/schemas/game.ts` (BGMI vocabulary), `lib/game-catalog/catalog.ts`.

## Edited shared files

| File | Change |
| --- | --- |
| `src/components/shared/site-header.tsx` | Added "Discover teams" to primary nav (desktop + mobile) |
| `src/components/shared/site-footer.tsx` | Added "Discover teams" to footer index |

## Tests

| File | Coverage |
| --- | --- |
| `src/features/teams/server/team-directory-reader.test.ts` | 12 tests: validation, fail-closed games, strict mapping, key-set, member-count, generic errors, 404-equivalence |
| `src/app/teams/_lib/query.test.ts` | 21 tests: parsing, fail-safe invalids, pagination bounds, href preservation/encoding, metadata, canonical |
| `src/app/teams/_components/components.test.tsx` | 19 tests: cards, filters, pagination, detail, disabled-write forms, recruitment, privacy |
| `src/app/teams/routes.test.ts` | 7 tests: static audit (reader-only, no writes, no internals) |
