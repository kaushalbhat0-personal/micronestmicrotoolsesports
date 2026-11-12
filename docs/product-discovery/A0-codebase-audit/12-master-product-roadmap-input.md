# 12 — Master Product Roadmap Input

**Purpose:** evidence-based inputs for Master Product Blueprint. No new build decisions made here.

## 1. What to carry forward (proven)

- G1 identity/player-profile + consent-first masked discovery + avatar/handle/deletion + BGMI catalog (4 tables, 7 RPCs, 3 buckets, 0→1 rows; tested; live-verified on `knniommcyyhbyiwljisk`).
- Marketing M0/M1/M2/M4: competitive-esports identity, `/` + `/about`, honest Coming-soon contract, no dead links, no fabricated claims.
- Architecture invariants: session-derived identity, RPC-only public reads, frozen 12-col projection, 404-equivalence, `noindex` on product routes, middleware never bootstraps, no service-role in `src/`.

## 2. Phase sequencing (from `mvp-roadmap.md` + gaps)

1. **Discovery MVP (Phases 2–4):** teams, org-divisions, brands, opportunities/applications + shared search + roles + verification/moderation queues. Biggest gap: all domain models absent. Depend on `app_users` FKs + `games(key)` refs; never migrate `finder_*`.
2. **News (Phase 5):** `news_articles` + editor role + taxonomy + attribution + published listing/pages + SEO. No reuse beyond Meta-Parser pipeline pattern.
3. **Tournaments (Phase 6):** editorial listing + detail + title association, staff-listed only (D-05). Mine legacy ingest observability; rebuild schema.
4. **Engagement (Phase 7):** 1–2 profile-linked drills reusing BGMI Lab share pattern; soft signal, never score; no leaderboards/prizes.
5. **Tools/paid (deferred D-10/D-17):** no pricing/billing until discovery proves out. If pursued, ADAPT billing rails + REBUILD Sentinel; RETIRE organizer-utility engines unless new pillar justifies them.

## 3. Dependencies / risks

- Teams/orgs/brands models block opportunities, verification, moderation, shared search, notifications, audit.
- Editor/admin roles block news/tournament publishing.
- Billing/entitlement decisions (D-10/D-17) block any paid tool; legacy INR/USD prices are void.
- Unknowns: deployment history, production row volumes beyond public tables, legacy billing live-charge proof, `YOUTUBE_WEBSUB_VERIFY_TOKEN` / `BILLING_LIVE_TEST_*` currency, analytics metric definitions.

## 4. Non-goals (enforced)

Tournament operations (brackets/scheduling/scoring/payments/prizes), automated matching scores, chat/escrow/contracts, aggregation/comments/syndication, new games/leaderboards-as-identity/prizes, microservices, G1 modifications, legacy migration restores, sibling project access.

## 5. Acceptance gates for blueprint

- Each new domain ships only with tables + RLS + RPCs + tests + routes + marketing availability update together (no stubs/dead links — `marketing.test.tsx` pattern).
- Reuse items require fresh security review (RLS/auth) and product review (pricing/copy).
- Retired items stay dormant with retention decision logged; never silently deleted.
