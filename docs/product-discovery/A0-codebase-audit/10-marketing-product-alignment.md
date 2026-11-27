# 10 — Marketing & Product Alignment

**Locked direction:** Competitive Esports (arena dark + editorial light + controlled red accent + condensed competitive type). Do not redesign during audit.

## 1. Current claims (verified in code)

- Homepage (`src/app/page.tsx`): H1 "Where esports talent gets discovered"; sub "connected discovery ecosystem for players, teams, organizations and brands. Public player discovery is live today — only players who choose to be discoverable appear." Badge "Live now: public player directory". Sections: Ecosystem (01–03 Live now, 04 Teams/orgs/brands discover Coming soon), AudiencePathways (Players Live now + `/players` link; Teams/Orgs/Brands Coming soon, no links), RoadmapStrip (Tournaments, Opportunities, News & mini games — Planned, no links/CTAs/dates).
- About (`src/app/about/page.tsx`): `served[]` Players Live now / Teams-Orgs-Brands Coming soon; `availability[]` 4× Live now (directory, profile pages, consent + per-game visibility, avatar/handle/deletion) vs 3× Coming soon (team/org/brand discovery; opportunities/applications/recruitment; tournaments/news/mini games). Contract lede: "Anything marked Coming soon has no route, no workflow and nothing to join until it ships."
- Header (`site-header.tsx`): primaryLinks `/players`, `/about` only; secondary Settings; CTA Explore players. Footer (`site-footer.tsx`): links `/`, `/players`, `/about` + "Availability: public player discovery is live now. Teams, organizations, brands, opportunities, tournaments, news and mini games are planned and labelled Coming soon — never sold as shipped."
- Guards (`marketing.test.tsx:126-143`): asserts homepage contains no `/teams|/organizations|/brands|/opportunities|/tournaments|/news` hrefs; no fabricated sponsors/prices.

## 2. Mapping vs 5 product categories

| Category | Status | Evidence |
|---|---|---|
| 01 Discover (players) | Available (Live now) | `/players` + `/players/[handle]`, filters game/region/role/name, footer "Only players who choose to be discoverable appear" |
| 01 Discover (teams/orgs/brands) | Coming soon | RoadmapStrip + About + footer; no routes |
| 02 Tournaments | Coming soon (Planned, no route/link/date) | `roadmap-strip.tsx:11`; `about/page.tsx:59`; footer |
| 03 News | Coming soon (bundled "News & mini games") | `roadmap-strip.tsx:13`; About availability row |
| 04 Esports Tools | Absent (no label/route) | Zero hits in `src/` for `esports.?tools|tools`; closest is Opportunities (Coming soon) — not tools |
| 05 Mini Games | Coming soon (bundled with News) | Same as News; no playable component, no `/mini-games` route |

## 3. Assessment

Marketing is honest: every unshipped domain lives only in RoadmapStrip with Planned badge, no links/CTAs/dates; no signup/join/register CTA (G1-8B pending, test-enforced); hero notes "Illustrative listing format — real entries appear only when players opt in" (`arena-hero.tsx:70-73`).

## 4. Future revision needs (do not implement now)

- When Teams/Orgs/Brands ship: upgrade corresponding AudiencePathways cards + Ecosystem step 04 + About `served[]`/`availability[]` + footer honesty statement; add routes to header/footer/sitemap only when live.
- Esports Tools category needs explicit positioning decision — currently absent as a label. If tools pillar is pursued, introduce a dedicated roadmap item separate from Opportunities; do not silently relabel Opportunities as Tools.
- Tournaments/News/Mini-games must graduate from bundled "News & mini games" / "Tournaments" roadmap chips to individual Available states with routes only when Phase 5/6/7 acceptance met. No date promises until then.
