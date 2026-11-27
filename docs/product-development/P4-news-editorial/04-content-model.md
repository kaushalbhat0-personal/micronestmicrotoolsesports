# 04 — Content Model (PROPOSAL ONLY — NO MIGRATION EXISTS)

> Constraint: no migration application, no remote SQL or writes. Everything
> below is an acceptance target. The runtime reader resolves to the honest
> unavailable state until this is accepted, migrated, and verified.

## Proposed tables (sketch, subject to owner + RLS review)

- `news_articles` — `id (uuid, pk)`, `slug (text, unique, immutable)`,
  `headline`, `summary`, `category`, `game_key (nullable FK → public.games)`,
  `tags (text[])`, `hero_image_url (nullable)`, `hero_image_alt (nullable)`,
  `author_display_name`, `body (jsonb, structured blocks)`,
  `source_kind`, `source_name (nullable)`, `source_url (nullable)`,
  `lifecycle`, `published_at (nullable)`, `scheduled_for (nullable)`,
  `created_at`, `updated_at`.
- `news_article_revisions` (future) — immutable snapshots per edit for audit
  and corrections. Shape undecided; NOT read by the public path.

## Proposed masked RPC pair (D1/P1/P3 posture)

- `search_articles(p_game, p_category, p_query, p_tag, p_limit 1..60, p_offset 0..1000)`
  → `NEWS_DIRECTORY_COLUMNS` (11 cols), `lifecycle = 'published'` AND
  `published_at <= now()` only, ordered by `published_at DESC`.
- `get_article_by_slug(p_slug)` → 11 cols + `body`, `source_kind`,
  `source_name`, `source_url`; same visibility predicate; 0 rows = missing.
- Status/visibility derived at read time, never stored authority.
- `anon` + `authenticated` may execute the RPCs; base tables revoked from
  `anon`; no service-role in the request path.

## RLS sketch (requires `postgres-rls` review before any migration)

- Default-deny on both tables; public reads RPC-only.
- Writes owner-gated later (author + editor roles undecided — no policies
  proposed here).
- Slug + game immutability via grants + trigger (mirrors P3 posture).

## Why no migration now

Author identity, editorial authorization, content security, and database
policies are undecided (see 09). Migrating tables before those decisions
would create an ungoverned write surface. P4 therefore ships the reader
contract + validation, pinned by tests with a fake client.
