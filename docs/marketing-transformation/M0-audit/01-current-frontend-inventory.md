# 01 — Current Frontend Inventory (verified against source)

## Routes

| Route | Type | State |
|---|---|---|
| `/` | Marketing (home) | Scaffold: H1 + one paragraph (`src/app/page.tsx:9-22`). No sections. |
| `/players` | Product (public directory) | Implemented (G1-6): filters, streaming results, pagination. `noindex`. |
| `/players/[handle]` | Product (public profile) | Implemented (G1-6): projection-only sections, generic 404. `noindex`, `revalidate 60`. |
| `/settings/profile` | Authenticated app | Implemented (G1-7): consent, visibility, handle, completeness, deletion. `noindex, nofollow`, `force-dynamic`. |
| `/api/health` | Infrastructure | Health endpoint. |
| 404 / error boundaries | Shared | Generic copy, home link. |

No teams, organizations, brands, opportunities, news, tournaments, or
mini-games routes exist. Header renders a non-link "Opportunities" span
(`site-header.tsx:24`) — a placeholder, not a page.

## Shared components

- `SiteHeader`: brand link + Players / Settings links + Opportunities span.
  Sticky neither, no mobile menu (only 2 links today).
- `SiteFooter`: one-line platform descriptor.
- `Container` (max-w-5xl), `Button` (primary/secondary, slate-900).
- Players components: filters (GET form), results, pagination, player-card,
  player-avatar (`next/image`, `unoptimized`), profile-sections, skeleton.
- Settings section components (5): discoverability, game-visibility,
  handle, completeness, danger-zone.

## Assets, typography, tokens

- Assets: none (`public/.gitkeep` only). No logo, no imagery, no OG images.
- Typography: system default (no `next/font`, no custom stacks).
- Color: Tailwind defaults; slate-900 primary actions, slate grays, one
  amber notice, red danger-zone accents. No brand tokens, no dark theme.
- `globals.css`: 16 lines — light `color-scheme`, white bg, slate-900 text.

## SEO metadata

Root layout uses `siteConfig` title template + description. Players routes
set projection-only titles, canonicals when `NEXT_PUBLIC_APP_URL` is set,
and `noindex` everywhere (frozen G1 posture — must be preserved until an
indexing decision exists). No OpenGraph/Twitter images, no JSON-LD, no
sitemap/robots extensions beyond defaults.

## Marketing vs application separation

Marketing today = `/` only. Everything else is product or app surface.
Proposed marketing IA in `05-information-architecture.md` keeps this split:
new static marketing routes never import `DirectoryReader`, Supabase
clients, or feature-server modules (enforced by the existing
`routes.test.ts` static-audit pattern).
