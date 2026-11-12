# 05 — SEO & Metadata Audit (Gate 5)

Method: production HTML `<head>` inspection (`/` 200, `/about` 200,
`/players` 200) + `/sitemap.xml` fetch. Destinations use the configured
`NEXT_PUBLIC_APP_URL` (`https://micronestmicrotoolsesports.vercel.app/`).

## Homepage `/`

- Title `Where esports talent gets discovered` (+ root template for children).
- Honest description (live directory now; rest on roadmap).
- Canonical `…/` absolute — emitted because the env URL is configured.
- Open Graph: `og:type website`, `og:url`, `og:title`, `og:description`.
  **No `og:image`** — no brand raster exists and none was fabricated
  (M1–M2 posture, reconfirmed). Twitter `summary` card with title/description.
- No `robots` meta → indexable. Favicon `/icon.svg` wired.

## About `/about`

- Title `About the platform | MicroNest Esports`, own description, canonical
  `…/about`, full OG + Twitter set, indexable. Single H1, hierarchical H2s.

## Product posture (unchanged, verified)

- `/players`: `robots noindex, follow` + canonical — **preserved**.
- `/players/[handle]`, `/settings/profile`: noindex posture untouched (source
  files unmodified; G1 freeze holds).
- No `robots.txt`/`robots.ts` added: the default (crawlable) + per-page
  `noindex` meta is exactly the frozen posture; a robots file would add no
  protection and risks misconfiguration.

## Sitemap — resolved YES for `/about`

New `src/app/sitemap.ts` (static, `○ /sitemap.xml` in build output):

```xml
<loc>https://micronestmicrotoolsesports.vercel.app/</loc>       <!-- weekly/1 -->
<loc>https://micronestmicrotoolsesports.vercel.app/about</loc>  <!-- monthly/0.8 -->
```

- Only shipped, indexable marketing routes. No product, auth, API or
  Coming-soon routes listed.
- Base URL from `getMarketingBaseUrl()` only; unconfigured → empty sitemap
  (never invent a domain). No G1-8B dependency — `/about` is static content
  with no session, form or publish surface.

## Social preview behavior

`summary`-card previews render title + description + (no image) on X-style
consumers; OG consumers show link previews without thumbnails. Acceptable and
honest until brand raster exists (M-future, not a gate).
