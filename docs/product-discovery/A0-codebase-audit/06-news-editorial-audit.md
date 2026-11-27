# 06 — News & Editorial Audit

## 1. Current capability: ABSENT (spec-only)

- No `/news` routes, no article models, no CMS integration (zero hits for contentful/sanity/strapi/notion in `src/`), no editorial workflows, categories/tags, publishing/moderation, or SEO article metadata. Only `editorial` hit is visual-copy comment in `bgmi-band.tsx:1`.
- Guards: `marketing.test.tsx:136` (no `/news` href), `M0-audit/05-information-architecture.md:18` (no stubs/dead links), `sitemap.ts` + `site.ts` + `canonical.ts` cover only `/`, `/about`, players (`noindex`).
- No tables/roles: no `news_articles`, author/editor roles, taxonomy, sources/attribution. `M0-audit/01-current-frontend-inventory.md:37-43` (no OG images, JSON-LD, sitemap extensions beyond defaults).
- Spec-only: `target-schema.md:43` (`news_articles(id,slug,title,category,game→game_titles NULL,body,sources jsonb,status draft|published|archived,author→profiles SET NULL,published_at)`), `mvp-roadmap.md:45-50` (Phase 5: categories, title association, CRUD, attribution, editor role, published listing + pages; out: aggregation, comments, syndication), `scope-freeze-proposal` + `rls-policy-design.md:21` + `authorization-matrix.md:35` (published SELECT to all; drafts to editors), `storage-design.md:17` (2MB media), `personas-and-roles.md:25` (`platform_admins` handle publishing), `06-storage-design.md:10` (news/tournament artwork future, unused in G1).

## 2. Legacy capability: no news system

Legacy had only static marketing `guides/[slug]`, `glossary/[slug]`, `use-cases/[slug]` pages + Meta-Parser external patch-note parsers (`features/meta-parser/adapters/valorant/sources.ts`, `parse.ts`) — not a publishable news CMS. No article CRUD, categories, or editorial queue to reuse.

## 3. Assessment

Nothing to reuse as a news system. Mine Meta-Parser safe-fetch/sanitize/entity-normalize/health pattern (ADAPT) only if news needs patch/intel ingestion. News requires greenfield build: `news_articles` table, editor role, category/game taxonomy, attribution sources, published listing + article pages, SEO (canonical/OG/JSON-LD), moderation queue. Keep separate from marketing static pages.
