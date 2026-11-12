# P4 — News & Editorial Platform

Status: **implemented (presentation + validation foundation; persistent publishing disabled)**.

MicroNest News is the editorial pillar of MicroNest Esports: a public reading
experience for industry news, game coverage, tournament announcements, team
updates, platform announcements, and guides — launching with BGMI, structured
for multiple esports titles.

## What shipped

- Public routes: `/news`, `/news/[slug]`, plus route-level `not-found` /
  `error` boundaries (invalid slug → 404; database outage → intentional
  unavailable state; no internal errors exposed).
- Game-agnostic editorial domain: article, category, game association
  (platform-wide or one supported title), tags, hero media, source
  attribution, lifecycle (draft → in_review → scheduled → published →
  unpublished → archived) separated from public visibility.
- Content security: strict Zod schemas, https-only external URLs, structured
  blocks only (never raw HTML), sanitized plain-text rendering, preserved
  attribution, original-vs-sourced distinction.
- Editorial workspace foundation (`/workspace/articles`, `/workspace/articles/new`):
  list, draft editor, live preview, metadata, source attribution,
  publish/unpublish controls — all visibly disabled. No simulated success.
- Design: Competitive Esports tokens, magazine-style hierarchy (dark
  editorial banner, kicker, headline, byline, body, source, trust note) —
  distinct from arena dashboards.
- P3 correction: valid-slug + database-unavailable now renders an
  intentional unavailable state with dedicated metadata (regression-pinned).

## What did NOT ship (by design)

- No migration, no remote SQL, no new RPCs in the database. Reads go through
  the PROPOSED `search_articles` / `get_article_by_slug` pair, which resolve
  to the honest unavailable state until accepted and migrated.
- No persistent publishing: `NEWS_WRITES_ENABLED = false` (audit-pinned).
- No fake production news or authors. Test fixtures are prefixed `TEST` and
  live only in `*.test.ts*` / component previews.
- No automated crawling or publishing.

## Map

- `01-product-scope.md` — editorial product scope.
- `02-routes-components.md` — routes and components.
- `03-domain-contracts.md` — domain contracts.
- `04-content-model.md` — proposed data model (PROPOSAL ONLY, no migration).
- `05-publishing-lifecycle.md` — lifecycle + disabled workspace.
- `06-security-report.md` — content security + authorization boundary.
- `07-legacy-reference.md` — Meta-Parser ideas reused (no runtime imports).
- `08-test-evidence.md` — tests and results.
- `09-decisions-next.md` — remaining owner decisions + next phase.
