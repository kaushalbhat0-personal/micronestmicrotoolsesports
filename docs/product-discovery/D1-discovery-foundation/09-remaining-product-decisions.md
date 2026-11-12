# 09 — Remaining Product Decisions (D1)

Blocking nothing in D1 pure logic. Required before migration apply / server ops.

## D1-D1: Multi-team membership
**Decision:** one user MAY belong to many teams (`PK(team_id,user_id)`). **Rationale:** tryouts/sub stints. **Action:** keep partial-unique + roster idempotency; monitor abuse.

## D1-D2: One team, one game
**Decision:** `teams.game_key` fixed at creation (D1). **Rationale:** BGMI-first, G1 vocabularies per title. Multi-game teams deferred.

## D1-D3: Captain authority
**Decision:** captain = `owner_user_id`|`created_by` OR member `captain`. Co-captain ≠ captain in D1. **Action:** security sign-off on dual authority before apply.

## D1-D4: Organization ownership
**Decision:** `teams.organization_id TEXT NULL`, non-authoritative, no FK in D1. **Rationale:** design for orgs without building them. No auth decisions on this column.

## D1-D5: Regions
**Decision:** BGMI vocabulary codes only (`india|asia|europe|north-america|south-america|middle-east|online`); free-text rejected. `regionsCompatible` legacy kept for reference; new validation uses `region_code`.

## D1-D6: Matching scores
**Decision:** forbidden. Tiers (`strong/good/stretch`) + factual reasons only.

## D1-D7: Verification
**Decision:** deferred. Callers pass `verified=false`, `tournamentEvidenceCount=0`. No badges until pipeline approved.

## D1-D8: Availability vocabulary
**Decision:** shape-only (`text[]`, server caps elements). Closed allowlist deferred.

## D1-D9: Reports retention
**Decision needed:** D1 uses `reporter CASCADE`. Confirm reviewer evidence-copy before account purge, or switch to `SET NULL` at apply time.

## D1-D10: Owner account deletion
**Decision needed:** `owner_user_id RESTRICT` forces transfer-first. Confirm transfer RPC scope (next phase) or document manual admin path.

## D1-D11: Billing/entitlement
**Decision:** none in D1. Roster intake + discovery free; no gates. D-10/D-17 remain.

## D1-D12: Migration acceptance
**Decision needed:** security + product sign-off on `20261112000001` + `20261112000002`, then apply to `knniommcyyhbyiwljisk` with pre/post table-list evidence. Until then: CONDITIONAL PASS stands.
