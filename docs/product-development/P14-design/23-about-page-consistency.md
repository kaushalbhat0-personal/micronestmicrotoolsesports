# 23 — About Page Consistency (P14-B3 Phase 1)

## Problem

`src/app/about/page.tsx` described Teams, Organizations, Brands, Tournaments
and News as “Coming soon” with the contract line “Anything marked Coming soon
has no route, no workflow and nothing to join until it ships.” That was false
on both counts after P14-B2: the routes exist (`/teams`, `/organizations`,
`/brands`, `/organizers`, `/tournaments`, `/news`), and the homepage links
them as live directories. The About page contradicted the homepage and the
footer availability statement.

## Factual basis (verified in-repo, no DB access)

| Capability | Route shell | Data path (code evidence) | Honest status |
|---|---|---|---|
| Player directory, profiles, consent/visibility, avatar/handle/deletion | `/players`, `/players/[handle]` | APPROVED D-G1-03 RPC-only `DirectoryReader` (`src/app/players/page.tsx:23`, `src/features/player-profile/tests/public-projection.test.ts`) | Live now |
| Prize Pool Splitter, Roster & Slot Builder, Tie-Break & Qualification Simulator | `/tools/[slug]` | Static `TOOL_REGISTRY`, runs in-browser (`src/features/tools/catalog.ts:152`) | Live now |
| Teams directory | `/teams` | D1 masked RPC pair, migrations local UNAPPLIED (`src/app/teams/page.tsx:24`, `src/features/teams/domain/team-directory.ts:3`) | Directory live |
| Organizations directory | `/organizations` | PROPOSED RPC pair, no migration exists (`src/app/organizations/page.tsx:22`, `src/features/organizations/server/organization-reader.ts:2`) | Directory live |
| Brands directory | `/brands` | PROPOSED RPC pair, no migration exists (`src/app/brands/page.tsx:22`, `src/features/brands/server/brand-reader.ts:2`) | Directory live |
| Organizers directory | `/organizers` | PROPOSED RPC pair, migration local-only (`src/app/organizers/page.tsx:25`, `src/features/organizers/domain/columns.ts:1`) | Directory live |
| Tournaments directory | `/tournaments` | PROPOSED RPC pair, no migration exists (`src/app/tournaments/page.tsx:27`, `src/features/tournaments/server/tournament-reader.ts:2`) | Directory live |
| News directory | `/news` | PROPOSED RPC pair, no migration exists (`src/app/news/page.tsx:27`, `src/features/news/server/article-reader.ts`) | Directory live |
| Publishing, ownership/verification writes | none | No route, no workflow | Planned |
| Opportunities, applications, recruitment | none | No route, no workflow | Planned |
| Mini games | none | Explicitly out of scope | Planned |

“Directory live” means exactly: the route, filters, pagination, skeletons and
invalid/unavailable/empty states ship — not that listings exist. No directory
fabricates rows; every reader fails to an explained empty or
temporarily-unavailable state.

## Change made

`src/app/about/page.tsx` rewritten (same visual language — arena hero,
`MarketingSection` rhythm, `ClosingCTA`; no redesign):

- `served` audiences keep Players = Live now; Teams/Organizations/Brands =
  Directory live with copy stating data appears only after backend activation.
- `availability` table expanded 7 → 16 rows across the three tiers above,
  including the three tools by name and the six directory-live routes.
- Contract lede rewritten: “‘Live now’ runs on real data today. ‘Directory
  live’ means the route, filters and honest empty or temporarily-unavailable
  states ship — not that listings exist. ‘Planned’ has no route workflow…
  Directory live never means populated: no listing is ever fabricated.”
- Metadata description updated to match (no “other domains are on the
  roadmap” blanket claim).
- Sharp geometry aligned (`rounded-sm` → `rounded-none`) with the
  Stitch-approved identity; content sections untouched.

Preserved: company/product positioning, BGMI-first multi-title statement,
problem/vision sections, consent-first language, KRAFTON non-affiliation is
footer-owned and unchanged.

## Test lock

`src/components/marketing/marketing.test.tsx` gains an “About availability
contract” block (2 tests): tiers render (`Live now` / `Directory live` /
`Planned` / `availability` / `no listing is ever fabricated`), `Coming soon`
is gone, tools and directory-live routes are named, mini games listed as
Planned. Suite: 16/16 pass.
