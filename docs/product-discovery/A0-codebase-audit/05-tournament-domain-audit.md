# 05 — Tournament Domain Audit

**Product definition (authoritative):** discovery + promotion only — browse, eligibility, registration links. Out of scope: brackets, scheduling, live scoring, payments, prizes, operations. Publishing by independent organizers + verified orgs.

## 1. Current capability: ABSENT (greenfield)

- No `/tournaments` routes, no entities, listings, organizer profiles, publishing flow, game/region filtering, registration links, banners, lifecycle, or moderation code in `src/`. Grep `tournament` in `src/` hits only footer/README/about/test-negative.
- Guards: `src/components/marketing/marketing.test.tsx:135` asserts no `/tournaments` href; `src/app/sitemap.ts` excludes product routes; `src/app/about/page.tsx:59` + `roadmap-strip.tsx:12` + `site-footer.tsx:28-29` label tournaments Planned/Coming soon with no links/CTAs/dates.
- No tables/RPCs: `20261110000001_foundation_baseline.sql:10-11` (no product tables), `supabase/seed.sql` empty, `live-schema-inventory.md:41` (no tournament tables).
- Spec-only: `backend-foundation/target-schema.md:44-45` (`tournaments(id,slug,name,game,organizer,starts_on,ends_on,format,entry_requirements,registration_url,registration_note,status,published)` + `tournament_links`), `mvp-roadmap.md:52-58` (Phase 6: listing + detail, title association, editorial management), `scope-freeze-proposal.md:25-28` + `decision-register.md:47-54` (D-05: staff-listed, not self-serve), RLS `published SELECT to all; drafts to editors`, storage `public-entity-media` artwork prefix.

## 2. Legacy capability: WORKING but out-of-scope (archived, dormant)

BGMI Tournament Hub at `ref/legacy-project/application/src/app/bgmi-tournaments/` + `features/bgmi-tournaments/` (Liquipedia + catalog adapters, `ingest/points/standings/stage-copy/validate` services, `bgmi_tournaments/stages/teams/stage_entries/matches/match_results` tables via `20251113000001_bgmi_tournaments_core` + `20251113000002_bgmi_bmsd_seed`), ingest route `app/api/ingest/bgmi-tournaments/route.ts`, daily workflow `bgmi-tournaments-ingest.yml` (body-gated), plus client-only `features/bgmi-qualification/` simulator. Tested (ingest/points/standings/liquipedia/qualification). Live counts referenced in `live-schema-inventory.md:21` (3 tournaments, 5 stages, 96 matches, 1539 results, 10 ingestion runs) — archive reference, not greenfield truth.

## 3. Classification

| Item | Status |
|---|---|
| Greenfield tournament discovery/promotion | To be created (Phase 6, editorial-only MVP) |
| Organizer self-serve publishing | Out of scope per D-05 (staff-listed only) |
| Brackets/scheduling/scoring/payments/prizes/operations | Out of scope, never to be built here |
| Legacy BGMI hub ingest + standings engine | ADAPT observability/adapter pattern only; REBUILD schema for discovery domain; do not import |
| Legacy qualification simulator | Reference logic only; not a tournament product |

Tournament discovery must stay separate from tournament operations. No legacy migration restores.
