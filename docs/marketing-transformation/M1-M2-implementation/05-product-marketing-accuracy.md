# 05 — Product–Marketing Accuracy (truthfulness record)

Classification source: M0 `02-product-messaging-audit.md`
(IMPLEMENTED / PARTIALLY / PLANNED). Every marketing claim below maps to it.

## Claim → evidence

| Marketing claim | Classification | Evidence |
|---|---|---|
| Public player directory + filters | IMPLEMENTED (G1-6) | Links to `/players`; `routes.test.ts` green |
| Public profile pages, handle URLs | IMPLEMENTED (G1-6) | Same |
| Discoverability consent, per-game visibility | IMPLEMENTED (G1-7) | `/settings/profile` untouched |
| Avatar upload, handle cooldown, deletion | IMPLEMENTED (G1-7) | Same |
| BGMI catalogue (one active title) | IMPLEMENTED (G1-4/6) | `game_name` copy |
| Team/org/brand discovery + management | PLANNED | `Coming soon` / `Planned` badges, no routes, no links |
| Opportunities, applications, recruitment | PLANNED | Same; header `Opportunities` span removed |
| Tournaments, news, mini games | PLANNED | Same |

## What was deliberately NOT done

- No metrics, partner logos, testimonials, rankings, verification claims.
- No signup/registration CTA, waiting list or publish promise (G1-8B pending).
- No `/teams`, `/organizations`, `/brands`, `/opportunities` stubs or dead nav.
- Hero visual uses templated placeholders (`@your-handle`) with an honesty
  caption — never presented as real users.
- Root `siteConfig.description` rewritten to the honest positioning
  (only consumer: root-layout fallback metadata).
- `noindex` on `/players`, `/players/[handle]`, `/settings/profile`
  preserved (files untouched); marketing `/` + `/about` indexable by default.

## Boundary decisions

- Marketing layer = `src/components/marketing/*`, `src/app/page.tsx`,
  `src/app/about/page.tsx`, `src/lib/canonical.ts`. No imports of Supabase
  clients, `directory-reader`, feature-server/domain modules — enforced by
  `marketing.test.tsx` (comment-stripped source audit + rendered-HTML audit).
- `Settings` kept as a secondary header utility link: the route is shipped
  and hiding it would reduce discoverability; it is not presented as
  marketing navigation. Revisit in G1-8B with a session-aware header.
- No product component, style or route was modified for visual convenience
  (`Container`, `Button`, players/settings surfaces untouched).
