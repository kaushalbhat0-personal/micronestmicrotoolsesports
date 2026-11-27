# 05 — Extraction Sequence

Aligned to `A0/12-master-product-roadmap-input.md` phases. Extraction never blocks product start — each phase pulls only what it needs.

## Phase 2–4 — Discovery MVP (first)

Needed: teams, org-divisions, brands (shell), opportunities/applications, shared search, roles, verification/moderation queues.
- PORT: roster `normalize/parser` (intake hygiene), search-param parsers (directory filters).
- REIMPLEMENT: Finder team formation + `assertTeamCaptain`; recruitment/application lifecycle + partial-unique + accept→roster; level/role/region vocabularies (rewritten); masked-view pattern per entity; team-logo shape onto `public-entity-media`; static catalog pattern (BGMI-first).
- REIMPLEMENT: admin/audit/ledger shape for review queues (`recordAdminAudit`, `safeAuditProjection`, `cron_run_ledger` pattern, `is_super_admin` gate).
- DOCUMENT: org role-matrix RPC design; reports shape; verification submission spec.
- Explicitly not now: Sentinel build, billing activation, VOD automation, analytics.

## Phase 5 — News (second)

- REIMPLEMENT: Meta-Parser `safe-fetch/sanitize/entity-normalize/health` + adapter-registry shape + revision (`unchanged` vs `revised`, provisional→promote) for `news_articles` editorial pipeline.
- DOCUMENT: numeric-extract/direction-map only if patch-intel section approved.
- No patch tables; no CMS vendor until approved.

## Phase 6 — Tournaments (third)

- REIMPLEMENT: validate-before-publish gate + body-gated ingest observability + ledger for staff-listed tournament ingestion (D-05).
- PORT: roster `conflicts/slots/output` for organizer registration intake (pure only).
- DOCUMENT: points/standings math (reference; product stays discovery-only).
- REJECT: legacy tournament schema/seed, qualification simulator product, brackets/operations.

## Phase 7a — Free tools (parallel with 5/6 when approved)

- PORT: roster `normalize/parser/conflicts/slots/output` + zod schemas + CSV guard as first free-tool logic. Fresh UI, no entitlement gate.
- No billing tables; no paid unlock.

## Phase 7b — Mini-games (last, 1 drill)

- REIMPLEMENT: BGMI Lab loader/island + status machine + share-URL/challenge + one drill (Circle IQ or Loot Dash, rewritten). Ephemeral, profile-linked soft signal, no leaderboards/prizes.

## Deferred — Paid tools + Brand proof (only after D-10/D-17 + brand pillar)

- DOCUMENT now, REIMPLEMENT later: billing provider abstraction + HMAC/verify + idempotency + expiry math; Sentinel evidence model + evaluator + orchestrator + OAuth/webhook concepts.
- Never restore: legacy prices/plans/products/RPCs/migrations.

## Order summary

1. Discovery MVP extractions → 2. News pipeline pattern → 3. Tournament ingest observability → 4. Free-tool PORT → 5. One mini-game → 6. Paid/Sentinel (gated). Each step independently tested and accepted; dormant utilities are never extracted merely because they exist.
