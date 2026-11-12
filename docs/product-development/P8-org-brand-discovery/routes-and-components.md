# P8 routes and components

## Routes

| Route | File | Data path |
|---|---|---|
| `/organizations` | `src/app/organizations/page.tsx` | `parseOrganizationsQuery` → `OrganizationResults` → `searchOrganizations` (proposed RPC) |
| `/organizations/[slug]` | `src/app/organizations/[slug]/page.tsx` | `getOrganizationBySlug` only; `notFound()` on invalid/missing; `revalidate = 60` |
| `/brands` | `src/app/brands/page.tsx` | `parseBrandsQuery` → `BrandResults` → `searchBrands` (proposed RPC) |
| `/brands/[slug]` | `src/app/brands/[slug]/page.tsx` | `getBrandBySlug` only; `notFound()` on invalid/missing; `revalidate = 60` |

All pages: thin orchestration (~15-line spirit), `noindex, follow` robots,
canonical from `NEXT_PUBLIC_APP_URL` only, `Suspense` + skeleton streaming,
invalid-filter notice, `invalid → explained empty` vs `transport → unavailable`
inline states, 404-equivalence for missing/private slugs.

## Query boundaries (`_lib/query.ts` + `query.test.ts`)

- Pure modules (no Supabase/headers/rendering). Fail-safe: invalid params
  dropped + named in `invalid`; pagination bounded (`PAGE_SIZE = 24`,
  `MAX_PAGE = 42` → offset ≤ 984 inside the 0..1000 clamp; `limit = size + 1`
  over-read for `hasMore`).
- Organizations: `game | region | type | query | page`. No recruitment filter
  (ungrounded by design).
- Brands: `game (= gameInterest) | industry | region | interest |
  partnership | query | page`. `interest` = declared intent, never availability.

## Components

- Cards: initial-letter avatar (no fabricated imagery), honest trust badge,
  counts/interests, slug links, `article` + labelled headings.
- Filters: server-rendered GET forms (work without JS), shareable URLs,
  labelled controls, catalogue-driven game options + BGMI region vocabulary.
- Results: `search*` only; empty/invalid/unavailable states; `role=status`
  counts; pagination preserving valid filters.
- Profile sections: public-only fields, trust note, team-independence /
  recruitment-unavailable / representation-unavailable / opportunity-unavailable
  notes, https external links with handoff note, accessible headings/labels.
- Skeletons: aria-hidden shimmer placeholders.

## Navigation

- `SiteHeader` primary links += Discover organizations, Discover brands
  (desktop + mobile).
- `SiteFooter` explore links += both; availability copy updated to name the
  proposed-contract posture.
- No redesign of player/team/tournament experiences; homepage roadmap strip
  left untouched (content decision for owners).
