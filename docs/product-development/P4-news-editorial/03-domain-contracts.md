# 03 — Domain Contracts

Source: `src/features/news/domain/` + `src/features/news/schemas/article.ts`.

## Entities

- **Article** — `slug`, `headline` (≤140), `summary` (≤300), `category`,
  `gameKey` (optional; `bgmi` or omitted = platform-wide), `tags` (≤8,
  hyphenated), `heroImageUrl` + `heroImageAlt` (alt required when image set),
  `authorDisplayName` (display string only — NOT an identity), `body`
  (1–80 structured blocks), `sourceKind` + `sourceName`/`sourceUrl`,
  `lifecycle`, `scheduledFor` (optional).
- **Author** — display name only in the public projection. No IDs, no
  identity model, no invented persons.
- **Category** — frozen enum: `industry | game-update | tournament | team |
  player | platform | guide`.
- **Game association** — optional supported key; `null` = platform-wide.
- **Tag** — lowercase hyphenated, 2–32 chars.
- **Media asset** — https URL + alt text; hostile URLs fail the row closed.
- **Source attribution** — `original` (no external link required) vs
  `sourced` (name + https URL required).
- **Editorial revision** — NOT in the public projection. Revision history is
  a future decision (see 09).

## Public projections

- `PublicArticleCard` — exactly `NEWS_DIRECTORY_COLUMNS` + derived
  `reading_minutes` / `excerpt` (compile-time guarded).
- `PublicArticleDetail` — card + `body` + `source_kind`/`source_name`/`source_url`.
- Never exposed: author IDs, revision history, scheduling internals,
  moderation metadata, lifecycle beyond `published`.

## Validation excerpts

- Slug: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 2–100, trimmed + lowercased.
- URLs: https-only, no credentials, hostname required, length-capped.
- Body: union of `paragraph | heading | quote | list`; unknown kinds
  (notably `html`) rejected; strict objects (protected keys rejected).
- Sourced stories without name+URL rejected; hero image without alt rejected.
