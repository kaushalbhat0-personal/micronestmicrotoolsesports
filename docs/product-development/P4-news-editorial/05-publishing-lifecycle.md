# 05 — Publishing Lifecycle

## Editorial status (internal)

`draft → in_review → scheduled → published → unpublished → archived`

- `draft` — being written; visible only in the workspace (future).
- `in_review` — awaiting editorial review; no public visibility.
- `scheduled` — approved with a future `scheduled_for`; no public visibility
  until the instant passes.
- `published` — approved for public reading (visibility additionally requires
  a live `published_at`; see below).
- `unpublished` — pulled from public reading; slug resolves to 404.
- `archived` — retained internally; slug resolves to 404.

## Public visibility (derived, never stored authority)

`lifecycle === 'published' AND published_at IS NOT NULL AND published_at <= now()`

`isPubliclyVisible()` in `domain/article.ts` is the single predicate. The
proposed RPCs enforce the same predicate server-side; the reader re-checks
defensively via output mapping (fail closed).

## Workspace today (presentation + validation foundation)

- List drafts (empty/unavailable/sign-in states — no fake rows).
- Draft editor with strict schema validation + live safe preview.
- Metadata fields (category, game association, tags, hero + alt, source).
- Source attribution (original vs sourced).
- Publish / unpublish / schedule controls exist but are **visibly disabled**
  (`aria-disabled`, explanatory title). Server actions validate then return
  `{ ok: false }` with `ARTICLE_WORKSPACE_DISABLED_MESSAGE`.
- `NEWS_WRITES_ENABLED: boolean = false`, audit-pinned by
  `src/app/news/routes.test.ts` + `src/app/workspace/articles/routes.test.ts`.

## Enabling publishing later (ordered acceptance)

1. Accept 04-content-model + RLS review.
2. Migrate + remote application by the authorized owner flow.
3. Approve author identity + editorial authorization (roles undecided).
4. Verify content-security + database policies (session-derived operations).
5. Flip the kill switch + update the gate tests (breaking change by design).
