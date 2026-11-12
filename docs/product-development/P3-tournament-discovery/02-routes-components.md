# P3 Routes and Components Inventory

## Routes (all `noindex`, canonical via `NEXT_PUBLIC_APP_URL` only)

| Route | File | Type | Data path |
| --- | --- | --- | --- |
| `/tournaments` | `src/app/tournaments/page.tsx` | Dynamic (searchParams) | Shell (arena hero + filters) + streamed `TournamentResults` |
| `/tournaments/[slug]` | `src/app/tournaments/[slug]/page.tsx` | Dynamic, `revalidate = 60` | `getTournamentBySlug` only; `notFound()` on null/invalid |

No organizer routes ship: organizer identity + moderation decisions are
pending (see 08). The publish form is unrouted foundation (see 05).

## Route support

| File | Responsibility |
| --- | --- |
| `src/app/tournaments/_lib/query.ts` | `parseTournamentsQuery`, `toTournamentSearchInput`, `buildTournamentsHref`, metadata + canonical builders; `TOURNAMENTS_PAGE_SIZE = 24`, `TOURNAMENTS_MAX_PAGE = 42` |

## Components (`src/app/tournaments/_components/`)

| Component | File | Notes |
| --- | --- | --- |
| `TournamentFilters` | `tournament-filters.tsx` | GET form: query, game (catalogue), region (BGMI vocab), status |
| `TournamentCard` | `tournament-card.tsx` | Status badge, dates, fee/prize, organizer, registration indicator |
| `TournamentStatusBadge`, `TournamentDates`, `TournamentMoney`, `RegistrationIndicator`, `gameDisplayName` | `tournament-bits.tsx` | Shared display bits |
| `TournamentResults` | `tournament-results.tsx` | Async RPC block; grouped sections without status filter, flat with; empty/error states |
| `TournamentsPagination` | `tournaments-pagination.tsx` | Filter-preserving prev/next |
| `TournamentsResultsSkeleton` | `results-skeleton.tsx` | Streaming fallback |
| `TournamentDetail` | `tournament-detail.tsx` | Arena banner, facts grid, about, eligibility, registration handoff, trust |
| `OrganizerCard` | `organizer-card.tsx` | Kind + name + unverified note |
| `TournamentPublishForm` | `publish-form.tsx` | Validation-only, no action, disabled submit (unrouted) |

## Domain / server (`src/features/tournaments/`)

| File | Responsibility |
| --- | --- |
| `domain/tournament.ts` | Statuses, formats, lifecycle, `deriveStatus`, `isRegistrationOpen` |
| `domain/dates.ts` | Instant parsing, IANA validation (constructor probe), in-zone formatting, ordering |
| `domain/money.ts` | Minor-unit amounts, `formatEntryFee`/`formatPrizePool` |
| `domain/organizer.ts` | Kinds, `OrganizerRef` (verified frozen false), trust note |
| `domain/registration.ts` | External-only method, https URL rules, handoff note |
| `domain/columns.ts` | Proposed 14-column contract (logic-free) |
| `domain/public-card.ts` | `PublicTournamentCard`/`Detail`, domain errors, write-disabled error |
| `schemas/tournament.ts` | Draft (strict + date ordering), update, unpublish, eligibility, directory inputs |
| `services/search.ts` | Pure search-param parser |
| `server/tournament-reader.ts` | `searchTournaments`, `getTournamentBySlug` vs PROPOSED RPCs |
| `server/tournament-writer.ts` | `TOURNAMENT_WRITES_ENABLED = false`; validated-then-gated ops |

Reused unchanged: game catalogue, BGMI vocabulary, site header/footer
(+Tournaments links, additive), arena/paper/accent tokens.

## Tests

| File | Coverage |
| --- | --- |
| `tests/domain.test.ts` | 12: status, registration gating, dates/timezones, money, organizer, URLs |
| `tests/schemas.test.ts` | 10: draft/update/unpublish/eligibility/directory contracts |
| `tests/services-writer.test.ts` | 6: parser defaults, kill switch, gated ops |
| `server/tournament-reader.test.ts` | 12: validation, strict mapping, fail-closed rows, 404-equivalence |
| `_lib/query.test.ts` | 18: parsing, fail-safe invalids, bounds, hrefs, metadata, canonical |
| `_components/components.test.tsx` | 15: cards, filters, pagination, detail, organizer, publish form |
| `routes.test.ts` | 9: static audit (reader-only, no payments/ops flows, no writes, gate ON) |
