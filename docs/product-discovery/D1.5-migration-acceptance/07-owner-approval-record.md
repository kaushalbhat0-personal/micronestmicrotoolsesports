# 07 — Owner Approval Record

Rule: no approval is inferred from implementation existence. "Approved" means
explicit product-owner approval with provenance. Everything else is
"Recommended" (reviewer position) or "Awaiting approval".

## Approved (explicit owner approval, provenance cited)

Only G1 items are approved. No D1 item is approved.

| ID | Position | Provenance |
|---|---|---|
| D-G1-01 lazy bootstrap | APPROVED | G1 decision-freeze conversation (`10`/`11`) |
| D-G1-02 deny owner UPDATE app_users | APPROVED | same |
| D-G1-03 RPC-only projections | APPROVED | same |
| D-G1-04 omit `game_user_id` (Option A 2026-11-11) | APPROVED | explicit 2026-11-11 (`D-G1-04-decision-brief`, `10`, `11`) |
| D-G1-05 handle throttle ~30d (Option A) | APPROVED | explicit 2026-11-11 |
| D-G1-07 hard delete (Option A) | APPROVED | explicit 2026-11-11 |
| D-G1-08 completeness set | APPROVED | explicit 2026-11-11 |
| D-G1-09 separate vocabularies | APPROVED | decision-freeze conversation |
| D-G1-10 email gate (Option A) | APPROVED | explicit 2026-11-11 |
| Discoverability consent copy | APPROVED | explicit 2026-11-11 |

## Recommended, awaiting approval (reviewer position, NOT approved)

| ID | Recommended position | Owner action needed |
|---|---|---|
| D1-D1 multi-team | Allow many (`PK`), monitor abuse | Approve (a)/(b)/(c) + cap number if any |
| D1-D2 one-game teams | Fixed `game_key` at creation | Approve BGMI-first; confirm F-T01 column freeze |
| D1-D3 captain authority | Dual (owner/creator/member-captain); co-captain none | Approve authority model + security sign-off |
| D1-D4 org ownership | Independent; `organization_id` inert text | Approve org roadmap; confirm no org auth in D1 |
| D1-D5 regions | BGMI vocabulary only | Approve vocabulary |
| D1-D6 matching | Tiers only, no scores | Approve |
| D1-D7 verification | Deferred (`verified=false`) | Approve deferral + trust copy |
| D1-D8 availability | Count/element caps now, allowlist later | Approve word list later; approve caps |
| D1-D9 reports | `SET NULL` + evidence-copy; visibility stays admin-only | **Required:** retention + moderation SLA + reporter receipt |
| D1-D10 owner transfer | RESTRICT + dedicated transfer RPC; interim admin path | **Required:** transfer scope + support procedure |
| D1-D11 billing | None in D1 | Approve free scope |
| D1-D12 acceptance | NOT ACCEPTED (this review) | Security + product sign-off after fixes + replay tests |

Cross-cutting awaiting approval: recruitment-post lifecycle + expiry behavior;
duplicate/repeat application windows; applicant/member PII visibility scope;
`availability_required` word list; cron/audit read-visibility for super-admins.

## Explicitly not approved / not built

Organization membership and permissions; team owner-transfer RPC; recruitment
discovery RPC; application decision RPC; admin grant/revoke RPCs; audit viewer;
cron routes; org audit logs; billing/entitlement; legacy prices/plans. None may
be assumed from design-doc mentions.

## Sign-off block (owner)

- [ ] D1-D1 … D1-D11 decisions approved as marked (or amended).
- [ ] F-T01/F-T02/F-T03/F-A01/F-T06 corrections approved.
- [ ] D1-D9 retention + D1-D10 transfer procedures approved.
- [ ] Privacy scope (F-T08) approved.
- [ ] D1-D12 migration acceptance granted (separate apply authorization still required).
- Owner: ____________________ Date: __________ Ref: __________
