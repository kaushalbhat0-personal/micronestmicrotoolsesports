# Backend Foundation Blueprint — README

**Status:** Architecture and planning only. No migrations written, no database touched, nothing implemented.
**Baseline:** Approved D-01 (BGMI-first, multi-title-ready), D-02 (distinct recruiter role), D-11 (fresh domain tables); D-14 parity audit complete (11/58 history recorded, schema verified matching); D-08/D-09 numbers still OPEN.
**Markers:** **[Approved]** (owner), **[Proposed]** (technical recommendation, not approval), **[Assumption]**, **[Open]**, **[Risk]**.

## Files

1. `migration-baseline-strategy.md` — **[Proposed]** forward-only baseline; approaches A–D evaluated.
2. `local-database-toolchain.md` — PG17/15 alignment, `db:types` fix, CI lanes.
3. `target-schema.md` — concrete tables, columns, keys, status sets.
4. `relationships-and-constraints.md` — FK discipline, uniqueness, guards, deletion rules.
5. `authorization-matrix.md` — 10-actor permission matrix per domain.
6. `rls-policy-design.md` — policy intent per table (no SQL written).
7. `storage-design.md` — buckets, paths, limits.
8. `repository-and-service-architecture.md` — module boundaries for implementation.
9. `testing-strategy.md` — unit/RLS/lifecycle/migration tests incl. 7 mandated cases.
10. `implementation-sequence.md` — staged build order with dependencies and acceptance.
11. `remaining-decisions.md` — what still needs the owner.

## Non-negotiables carried in

Fresh domain tables (no legacy finder migration); masked public projections; verification-before-publish for brands; no DMs; no scores; soft deletion where history matters; least-privilege EXECUTE; explicit `search_path`; live project unchanged until the approved sequence starts.
