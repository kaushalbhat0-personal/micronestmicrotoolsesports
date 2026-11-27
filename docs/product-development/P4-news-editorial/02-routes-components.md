# 02 — Routes and Components

## Public routes

| Route | File | Behavior |
|---|---|---|
| `/news` | `src/app/news/page.tsx` | Shell (arena banner + filters + invalid notice) + `Suspense` → `NewsResults`. `robots: noindex, follow`. |
| `/news/[slug]` | `src/app/news/[slug]/page.tsx` | `getArticleBySlug` only. Invalid → `notFound()`. Missing → `notFound()`. Outage → inline `role="alert"` unavailable. `revalidate = 60`. Related stories (same game first, cap 3). |
| `/news/[slug]/not-found.tsx` | route 404 | Generic "Story not found" (404-equivalence). |
| `/news/[slug]/error.tsx` | route boundary | Safety-net unavailable (unexpected throwables only). |

## Directory machinery

- `src/app/news/_lib/query.ts` — pure query parsing (`parseNewsQuery`,
  fail-soft + `invalid[]`), bounded pagination (`NEWS_PAGE_SIZE = 12`,
  `NEWS_MAX_PAGE = 84`, offset ≤ 1000), `toArticleSearchInput` (+1 over-read),
  `buildNewsHref`, metadata builders (directory / detail / not-found /
  **unavailable**), canonical via `NEXT_PUBLIC_APP_URL` only.
- `src/app/news/_components/` — `news-filters.tsx` (GET form, labelled
  game/category/query/tag), `news-results.tsx` (featured + latest sections,
  invalid/unavailable/empty states), `news-card.tsx`, `news-bits.tsx`
  (category badge, game marker, reading time), `news-detail.tsx`,
  `article-body.tsx` (structured blocks only), `related-stories.tsx`,
  `news-pagination.tsx`, `results-skeleton.tsx`.

## Editorial workspace (presentation + validation foundation)

| Route | File | Behavior |
|---|---|---|
| `/workspace/articles` | `src/app/workspace/articles/page.tsx` | `force-dynamic`, `noindex/nofollow`. Session check → sign-in prompt / empty / unavailable. Never lists fake rows. |
| `/workspace/articles/new` | `src/app/workspace/articles/new/page.tsx` | `ArticleDraftEditor`: local state, schema validation, live preview, disabled publish/unpublish. |
| actions | `src/app/workspace/articles/actions.ts` | Validation + gate only; always `{ ok: false }` with the disabled message. |

## Navigation

- `SiteHeader` + `SiteFooter` gain the `News` link. Footer availability copy
  updated honestly (discovery routes live; content appears after editorial
  acceptance).
