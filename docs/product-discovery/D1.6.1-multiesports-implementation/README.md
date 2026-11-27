# D1.6.1 — Multi-Esports Architecture Lock & Safe Implementation

## Status

- **APPROVED (2026-11-11):** multi-esports architecture principle (`01`).
  Principle only — D1-D1…D1-D12 remain AWAITING unless separately answered.
- **Implemented locally:** `20261112000004_d1_insert_boundary_indexes.sql`
  (F-NEW-01 insert nullness + F-T13 read indexes); multi-title contract tests;
  F-NEW-01 static spec. No game records seeded. No G1 changes.
- D1.5 FAIL · D1.5.1/D1.5.2 CONDITIONAL PASS stand. Replay still BLOCKED.

## Documents

1. `01-approved-architecture-principle.md` — exact wording + boundary.
2. `02-current-architecture-audit.md` — implementation vs principle mapping.
3. `03-game-catalogue-contract.md` — stable key contract + how to add a title.
4. `04-identity-and-team-boundaries.md` — seven-layer separation.
5. `05-f-new-01-correction.md` — correction, tests, RPC interaction.
6. `06-technical-blocker-reconciliation.md` — blockers resolved vs deferred (+ runbooks).
7. `07-test-evidence.md` — counts by execution level.
8. `08-next-phase-gates.md` — what comes next.
