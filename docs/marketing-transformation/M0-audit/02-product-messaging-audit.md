# 02 — Product Messaging Audit

## Current messaging (all of it)

- Home H1: "MicroNest Esports" (`src/app/page.tsx:12`).
- Home paragraph: discovery + "recruitment and partnership opportunities.
  News, tournaments, and mini games are supporting sections."
  (`src/app/page.tsx:15-20`).
- Metadata description: "discovery and opportunity platform for players,
  teams, organizations, and brands" (homepage + `site.ts`).
- Players page: "Discover public player profiles. Only players who chose to
  be discoverable appear here." — accurate, consent-honest. Keep.
- Settings danger-zone: "Deleting your player profile does not delete your
  login or account." — accurate. Keep.

## Audience coverage

| Audience | Messaging today | Assessment |
|---|---|---|
| Players | Directory + profile + settings exist; no landing copy | Weak — no "why create a profile" story |
| Teams | Named in metadata only; zero routes/copy | Missing |
| Organizations | Named in metadata only; zero routes/copy | Missing |
| Brands | Named in metadata only; zero routes/copy | Missing |

## Feature-accuracy classification (nothing marketed may exceed this)

- IMPLEMENTED (may be shown with live proof/links): player profiles
  (canonical + per-game), public player directory + profile pages,
  discoverability consent + per-game visibility, avatar upload, handle
  change (~30-day cooldown), game-profile removal, canonical-profile hard
  deletion. BGMI catalogue (single active title).
- PARTIALLY IMPLEMENTED (may be named only as in-progress, no CTA):
  opportunities nav placeholder (span, no route); settings/profile
  management.
- PLANNED, NOT APPROVED (must not be advertised as available): team / org /
  brand discovery surfaces, recruitment/partnership workflows, news,
  tournaments, mini games. Per `11-decision-freeze.md` §8 these are out of
  G1 scope; D-08/D-09 open.
- NOT APPROVED: any stats, testimonials, partner logos, user counts,
  verification badges, rankings, or trust claims. The homepage sentence
  implying recruitment/partnership opportunities and supporting news /
  tournament / mini-game sections exist is the single misleading statement
  on the site — it must be rewritten in the first marketing pass because
  none of those surfaces exist.

## Messaging rules for all marketing phases

1. Every feature section maps to the classification above; planned items
   are labeled "Coming soon" with no signup CTA until G1-8B ships.
2. Consent-first language everywhere ("players choose to be discoverable").
3. Never "verified", badges, rankings, or skill claims (frozen D-G1-04/D-G1-08).
4. No numbers without a live data source.
