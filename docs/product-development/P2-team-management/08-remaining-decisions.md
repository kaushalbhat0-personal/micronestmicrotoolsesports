# P2 Remaining Decisions + Next Phase

## Unresolved owner decisions (register: `docs/product-discovery/D1.6-owner-decisions/`)

| Decision | Blocks | P2 posture |
| --- | --- | --- |
| D1-D3 captain authority matrix | Settings writes, post/member writes | UI + contracts live, writes gated |
| D1-D10 transfer / interim admin | Ownership actions, suspended-owner story | No UI, stated boundary |
| D1-D12 lifecycle + privacy | Roster id visibility, applications, post feed | Default-deny render, no feed |
| D1-D1 membership cardinality | Roster growth policy | Bounded reads (50), no cap invented |
| D1-D2 one-game confirmation | Creation semantics | Single-`gameKey` contract |
| D1-D4 org authority | Nothing (explicitly excluded) | Never read/checked/rendered as authority |
| D1-D9 reports | Nothing in P2 scope | No surface added |

## Integration blockers (unchanged from P1, now with a flip checklist)

P1 `06-blockers-next-phase.md` gates 1–4 still apply; P2 adds the
two-line flip (`05-server-integration-plan.md` Gate 3) plus the
marketing follow-up (RoadmapStrip/footer reword only after liveness).

## Recommended next phase (P3)

**P3 — Recruitment operations (gated):** after D1-D3 + D1-D12 approval,
design the captain-decision RPC (captaincy + active-applicant checks +
audit record, per `03` §Captain decisions), the guarded post lifecycle
(open/paused/closed/filled + expiry rule), withdraw + re-apply windows,
and the applicant-own-history feed. Each ships with its RLS execution
matrix before UI wiring. No org scope, no billing scope, no new games.
