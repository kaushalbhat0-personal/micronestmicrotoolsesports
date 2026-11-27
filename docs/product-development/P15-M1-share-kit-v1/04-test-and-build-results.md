# 04 — Test and Build Results

## Commands (local)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS (exit 0) |
| `npm run lint` | PASS (exit 0) |
| `npm run build` | PASS (exit 0); route `/campaigns/bgmi-season` listed |
| `npm test` (unit lane) | PASS — **110** files / **1049** tests |

## New / updated tests

| Suite | Coverage |
|---|---|
| `src/lib/share-kit/share-kit.test.ts` | Render blob, failures, sanitize, download |
| `src/features/tools/share/share-cards.test.ts` | Prize / roster / tiebreak specs + CSV |
| `src/app/tools/[slug]/_components/prize-over-allocation.test.ts` | Engine still throws; contract for runner catch |
| `src/features/player-profile/share/player-card-model.test.ts` | Allowlist, forbidden keys, honest copy |
| `src/features/teams/share/team-card-model.test.ts` | Recruiting true/false, no private keys |
| `src/app/campaigns/bgmi-season/page.test.tsx` | Links + noindex + no official PMGC claim |
| `marketing.test.tsx` | Footer includes campaign href |

## Browser evidence

Unit/mock canvas coverage exercised generation + download hooks. Full visual PNG pixel QA in a live browser was not automated in this milestone; recommend manual spot-check on Preview after authorized deploy.

## Sitemap / robots

- Campaign metadata: `robots: { index: false, follow: true }`.
- `src/app/sitemap.ts` unchanged (marketing `/` + `/about` only).
