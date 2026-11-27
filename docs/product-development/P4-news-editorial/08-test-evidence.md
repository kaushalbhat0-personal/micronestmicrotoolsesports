# 08 — Test Evidence

> Static tests run locally. Integration (actual PostgreSQL/RLS) is NOT run
> in this phase: no migration exists, no database writes are permitted, and
> `npm test` excludes `*.integration.test.ts` by design.

## Suites added (P4)

| Suite | File | What it pins |
|---|---|---|
| Domain | `src/features/news/tests/domain.test.ts` | Lifecycle/category vocab, visibility separation, reading time, excerpt |
| Schemas | `src/features/news/tests/schemas.test.ts` | Slug/URL/tag/game/source/strict-matrix |
| Sanitize | `src/features/news/tests/sanitize.test.ts` | Tag stripping, entities, whitespace, https-only URLs |
| Writer gate | `src/features/news/tests/services-writer.test.ts` | Kill switch OFF, validate-then-block, no fake success |
| Reader | `src/features/news/server/article-reader.test.ts` | Fake-client mapping, platform-wide null game, fail-closed rows, generic errors, invalid-slug-no-RPC |
| Query | `src/app/news/_lib/query.test.ts` | Filters, fail-safe, pagination bounds, hrefs, metadata incl. unavailable, canonical |
| Components | `src/app/news/_components/components.test.tsx` | Cards, safe body (XSS-escaped), detail/source, filters, pagination, related, responsive |
| News audit | `src/app/news/routes.test.ts` | Reader exclusivity, no tables/service-role/internals/raw HTML/fake content, kill switch |
| Workspace audit | `src/app/workspace/articles/routes.test.ts` | No fake success, no table writes, disabled controls |
| P3 regression | `src/app/tournaments/[slug]/unavailable-state.test.ts` | Invalid→404, valid+down→unavailable, no internal detail |

## Regression posture

- P1/P2/P3/G1 suites untouched and expected green; P4 adds files only
  (plus the additive P3 correction: `buildTournamentUnavailableMetadata`,
  inline unavailable UI, route `error`/`not-found` boundaries).
- No P3/G1 database contracts or migrations changed.

## Commands (run in order)

```bash
npm test        # static unit suite (excludes *.integration.test.ts)
npm run typecheck
npm run lint
npm run build   # production build
```

## Results (2026-11-11, this phase)

- `npm test` — **61 files / 625 tests, all green.** New: 61 P4 tests
  (domain 6, schemas 12, sanitize 5, writer gate 3, reader 9, news query 17,
  news components 12, news audit 9, workspace audit 5, P3 regression 6 —
  plus shared counts). Zero P1/P2/P3/G1 regressions.
- `npm run typecheck` — clean (after `npx next typegen` regenerated typed
  routes for `/news`, `/news/[slug]`, `/workspace/articles*`).
- `npm run lint` — clean.
- `npm run build` — success; `/news`, `/news/[slug]`,
  `/workspace/articles`, `/workspace/articles/new` all present in the route
  table.
- Live smoke (`next start`, proposed RPCs absent as expected):
  - `GET /news` → 200, honest "News unavailable" (no fake rows).
  - `GET /news/test-valid-slug` → 200, inline "Story unavailable" with
    `<title>News temporarily unavailable</title>`.
  - `GET /news/BAD SLUG!` → 404 (invalid stays 404).
  - `GET /tournaments/test-valid-slug` → 200, inline "Tournament
    unavailable" with `<title>Tournament temporarily unavailable</title>`
    (P3 correction verified end-to-end, not just at unit level).
- Static vs runtime: everything above is static. No PostgreSQL/RLS runtime
  tests were run (no migration exists; no writes permitted).
