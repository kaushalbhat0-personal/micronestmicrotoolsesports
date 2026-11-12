# 02 — Homepage Implementation (M2, Gate 2)

`src/app/page.tsx` — fully static server-component composition. No data
fetching, no client components, no signup CTA. Metadata: honest title +
description, canonical via `NEXT_PUBLIC_APP_URL` when configured
(`src/lib/canonical.ts`), OpenGraph without images (no brand artwork exists;
none fabricated).

## Sections (in order — varied compositions, no card-grid repetition)

1. **Hero** (`arena-hero.tsx`) — full-bleed `arena-950` split. Eyebrow
   `BGMI-first · Multi-title ready`; H1 `Where esports talent gets
   discovered`; positioning subcopy with consent-first line; primary CTA
   `Explore players` → `/players`, secondary `Understand the platform` →
   `/about`; `Live now` availability marker. Visual = real product proof: a
   broadcast-style panel of the directory's listing *format* (`@your-handle /
   YourIGN / BGMI / Support · India`), captioned
   `Illustrative listing format — real entries appear only when players opt
   in.` No fake names, no fake stats.
2. **Ecosystem introduction** (`ecosystem.tsx`, `#ecosystem`) — `01–04`
   numbered rail (not cards): profile → opt-in discoverability → directory →
   teams/orgs/brands discover. Steps 1–3 badged `Live now`, step 4 badged
   `Coming soon`. No signup language.
3. **Player discovery** (`player-discovery.tsx`, steel band) — editorial split:
   five shipped capabilities exactly as implemented in G1-6 (filters, profile
   pages, consent + per-game visibility, handle cooldown, deletion) with CTA
   `Open the player directory`; proof panel `What every listing shows — and
   nothing more` (projection fields only + link to the availability
   statement).
4. **Four audience pathways** (`audience-pathways.tsx`) — standings-table rows
   with seed numbers `01–04` and a 2px ink rule: Players `Live now` + deep
   link; Teams / Organizations / Brands `Coming soon` + `On the roadmap`
   (no links — no dead routes).
5. **BGMI-first positioning** (`bgmi-band.tsx`) — giant editorial type
   (`BGMI first — every title next`, decorative, `aria-hidden`) + red-ruled
   fact list (one active title; per-game profiles; game-aware filters; new
   titles extend the catalogue). No exclusivity implied, no competitive
   claims.
6. **Coming-soon roadmap strip** (`roadmap-strip.tsx`, arena) — Teams,
   Organizations, Brands, Opportunities, Tournaments, News & mini games, each
   tagged `Planned`, no links/dates/promises.
7. **Closing CTA** (`closing-cta.tsx`, paper) — `Start with the players who
   are already here.` + `Explore players` / `About the platform`. No
   registration promise.

## Gate 2 check

Competitive identity (arena bands, condensed uppercase, scoreboard rows) is
evident; positioning is consent-first and truthful (see `05`); the shipped
directory is linked four times and previewed honestly; unshipped domains are
labelled, never linked.
