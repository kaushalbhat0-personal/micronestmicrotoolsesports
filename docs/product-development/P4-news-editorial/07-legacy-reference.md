# 07 — Legacy Reference Register (Meta-Parser)

Inspected: `ref/legacy-project/application/src/features/meta-parser/**`
(read-only; NO runtime imports, NO migrations, NO credentials, NO DB contracts).

## Ideas reused (reimplemented, not imported)

| Legacy file | Idea reused in P4 | Where |
|---|---|---|
| `services/sanitize.ts` | Plain-text sanitizer: strip HTML, decode entities, collapse whitespace, drop controls, never render raw HTML | `src/features/news/domain/sanitize.ts` (`sanitizePlainText`, `containsMarkup`) |
| `services/safe-fetch.ts` | HTTPS-only, no-credentials, length-capped external URL check | `isSafeExternalUrl` (same file) + schema `httpsUrlSchema` + reader re-validation |
| `services/entity-normalize.ts` | Lowercase/trim normalization for names | Slug + tag normalization (`trim().toLowerCase()` in schemas/reader) |
| `services/health.ts` | Freshness signals (stale content awareness) | Published/updated dates shown on every story; stale-schedule hidden by the visibility predicate |
| `server/admin/meta-parser-health.ts` + `cron_run_ledger` | Ingestion observability WITHOUT patching content timestamps | Principle recorded: future ingestion (if ever approved) must use a ledger, never mutate `updated_at`; NO ledger built in P4 (no crawling) |

## Explicitly NOT built

- No discover/diff/fetch/parse pipeline (`ingest.ts`, `adapters/*`).
- No stores, repositories, or service-role writes.
- No cron auth route, no scheduler workflow, no sitemap helper.
- **No automated crawling or publishing** — barred pending a separate
  safety + editorial review (per P4 brief §5).

## Verification

- `grep -r "from.*meta-parser\|legacy-project" src/features/news src/app/news src/app/workspace/articles` returns nothing (no runtime coupling).
- Route audits (`routes.test.ts`) would fail on `SERVICE_ROLE`, `.from("`, or `dangerouslySetInnerHTML` if legacy patterns leaked in.
