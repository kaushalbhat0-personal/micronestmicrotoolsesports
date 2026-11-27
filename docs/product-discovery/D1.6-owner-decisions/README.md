# D1.6 — Owner Decision Pack & Product Contract Freeze (Preparation)

## Purpose

Give the owner everything needed to resolve D1-D1…D1-D12 in one pass:
what each decision establishes, the alternatives, the recommendation, and the
security / privacy / schema consequences. No decision is pre-approved.

## Current status (frozen facts, not recommendations)

- **Decisions documented:** 12. **Approved:** 0. All AWAITING OWNER APPROVAL.
- **Separately APPROVED (D1.6.1 amendment, 2026-11-11):** the multi-esports
  architecture principle — BGMI launch title within a multi-title-ready
  architecture (exact wording in D1.6.1 `01-approved-architecture-principle.md`).
  This approves the principle only; it does not approve any of D1-D1…D1-D12,
  and D1-D5's detailed vocabulary/validation contract still requires explicit
  resolution.
- Migrations `...000001/000002/000003` local only, never applied; no runtime
  replay performed (BLOCKED under constraints — see D1.5.2 `04`).
- D1.5 verdict FAIL; D1.5.1 + D1.5.2 CONDITIONAL PASS (static only).
- Open security item: F-NEW-01 (application INSERT `decided_*` forgery).
- Evidence: `D1.5-migration-acceptance/`, `D1.5.1-security-remediation/`,
  `D1.5.2-runtime-verification/`.

## How to use this pack

1. Read `01-owner-decision-register.md` (all twelve, uniform format).
2. Read the deep-dives for the areas you care about (`02`–`05`).
3. Check `06-decision-dependency-map.md` for joint vs independent approvals.
4. Fill in `08-owner-response-sheet.md` — one row per decision.
5. Return the sheet; engineering resumes only after recorded answers.

## Approval integrity (mandatory)

Recommendations are never approvals. A decision becomes APPROVED only on the
owner's explicit response for that exact behavior. Ambiguous answers stay
AWAITING. No code, migration, or schema change may cite an unapproved
recommendation. Decision history is preserved in the register when anything
changes.

## Documents

1. `01-owner-decision-register.md`
2. `02-team-identity-and-authority.md` (D1-D1/D1-D2/D1-D3/D1-D10)
3. `03-recruitment-and-privacy-contract.md` (D1-D12 + F-NEW-01/withdraw)
4. `04-organization-and-verification-boundaries.md` (D1-D4/D1-D5/D1-D6/D1-D7/D1-D8)
5. `05-reports-and-retention.md` (D1-D9)
6. `06-decision-dependency-map.md`
7. `07-technical-blockers-separate-register.md`
8. `08-owner-response-sheet.md`
