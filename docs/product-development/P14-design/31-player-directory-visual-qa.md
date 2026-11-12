# 31 — Player Directory Visual QA (P14-B4 Phase 8)

Reference: Stitch screen “MicroNest Esports - Player Directory” (HTML
51,971 chars via Stitch MCP) + P14-B3 homepage language. Screenshots:
`players-{320,375,768,1024,1440}.png` (full-page),
`players-filtered-{…}.png` (chips), `players-390-filters-open.png` (mobile
disclosure). Local DB holds no public profiles, so captures show the real
empty state — the honest production outcome for an unpopulated directory.

## Comparison

| Area | Stitch | Implementation | Verdict |
|---|---|---|---|
| Header | Shared nav + Explore CTA | Untouched shared `SiteHeader` | Consistent (unchanged) |
| Page title | Eyebrow + H1 DISCOVER ESPORTS PLAYERS. | Arena carbon band, Oswald H1, opt-in copy | Match |
| Trust block | Consent/sovereignty charter (with banned claims) | 2-line self-declared/no-verification note + `/about` link | Intentional (truth correction) |
| Search/filter | Search + 5 labelled selects + APPLY/CLEAR | Search + game/region/role + Apply/Reset, same GET architecture | Intentional (reader-supported fields only) |
| Active filters | 5 chips with close | Per-filter remove chips + Clear all (server links) | Match (subset by contract) |
| Sort | 3 options | Omitted | Intentional (no approved sort) |
| Pagination | PREV 01 02 03 NEXT | Prev/Next + Page N | Intentional (no totals exist) |
| Cards | 4 specimens with IDs/badges/quotes | Arena cards (game band, avatar/initials, name, @handle, IGN, chips, modes, availability, bio excerpt, View Profile) from reader rows | Intentional (real data only) |
| Empty state | NO PLAYERS FOUND + clear action | Same + Clear filters (filtered) / About link (unfiltered) | Match |
| Loading | Skeleton note | Sharp skeleton, `role=status`, no telemetry copy | Intentional (no stream claims) |
| Mobile | Drawer/panel | `lg:hidden` disclosure, Escape close, focus into search; single-column cards | Match |
| Footer | Shared footer | Untouched shared `SiteFooter` | Consistent (unchanged) |
| Geometry | Sharp, thin borders, restrained crimson | 0px radii, 1px `slate-deep` borders, crimson keylines/badges | Match |

## Findings

- Overflow 0px at all 5 widths (filtered views included).
- No horizontal desktop table anywhere; cards stack to one column on mobile.
- Empty-state honesty confirmed visually: no fabricated rows, counts, or
  avatars in any capture.
- The circular “N” badge in dev captures is the Next.js dev overlay only
  (0 non-header fixed elements on production; clean prod capture verified).
- No regressions vs homepage language (same band, type scale, spacing,
  border rhythm, footer).
