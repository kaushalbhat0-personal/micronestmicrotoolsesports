# 10 — Open Product Decisions (P14-D1)

Historical register D1-D1…D1-D12 remains **AWAITING** unless the owner explicitly re-approves here.  
P14-D1 does **not** invent approvals. Implementation of security-material items is blocked until resolved.

Recommended positions below are advisory only.

---

## A. Security / integrity blockers (must resolve before writes)

| ID | Decision | Options (short) | Recommended | Blocks |
| --- | --- | --- | --- | --- |
| **P14-D1-A1** (= D1-D3) | Captain authority matrix | Dual owner+captain; owner-only; include co-captain subset | Dual; co-captain none | Settings writes, member RPCs, recruitment later |
| **P14-D1-A2** (= D1-D10) | Ownership transfer + suspended-owner interim | Transfer RPC + freeze; admin-only; designed interim admin | Transfer RPC + freeze writes | Create/update liveness with real owners |
| **P14-D1-A3** (= D1-D12 core) | Membership privacy: may teammates see roster user identities in workspace? | Yes team-visible; owner/captain only; handles only via player projection join | Team-visible handles in workspace only; public still count-only | Roster UI completeness |
| **P14-D1-A4** | Must creator receive a `team_members` captain row at create? | Yes seed captain; owner column only | Seed active captain row for creator | Create RPC transaction shape |
| **P14-D1-A5** | Email verification required to create teams? | Required; not required | Required (aligns with trust posture) | Create gate |
| **P14-D1-A6** | Migration path vs local D1 files | Supersede (A); Apply D1 then delta (B) | Supersede if status/role model adopted | P13 push coordination |

---

## B. Model choices (should resolve before schema freeze)

| ID | Decision | Recommended | Blocks |
| --- | --- | --- | --- |
| **P14-D1-B1** (= D1-D1) | Multi-team membership cardinality | Unlimited | Cap triggers / UX |
| **P14-D1-B2** (= D1-D2) | One game per team | Confirm one `game_key` | Avoids `team_games` |
| **P14-D1-B3** | `lifecycle_status` (`active`/`archived`) vs soft-delete | Add `lifecycle_status` | Public predicates |
| **P14-D1-B4** | Include `membership_status` now vs role-only D1 | **Include status** | Schema Option A vs B |
| **P14-D1-B5** | Logo / banner / country on team | Defer media; region sufficient for v1 | Storage policies |
| **P14-D1-B6** | Retain `manager` role | Omit | Role enum |

---

## C. Recruitment / applications (explicitly deferrable)

| ID | Decision | Recommended | Note |
| --- | --- | --- | --- |
| **P14-D1-C1** (= D1-D12 full) | Post + application lifecycle contract | Approve `D1.6/03` line-by-line or defer all writes | P3 |
| **P14-D1-C2** | Ship recruitment tables in foundation migrations? | **No** — omit until C1 | Keeps minimum schema |
| **P14-D1-C3** | Public recruiting filter param | Defer; display-only flag OK | RPC contract change |

---

## D. Non-blocking / already safe defaults

| ID | Topic | Safe default in code today |
| --- | --- | --- |
| D1-D4 | Org authority | `organization_id` inert |
| D1-D5 | BGMI vocabulary | Closed CHECKs / Zod |
| D1-D6 | Levels self-reported | Copy + note shipped |
| D1-D7 | Verification | Deferred; never render verified |
| D1-D8 | Availability caps | N/A until recruitment |
| D1-D9 | Reports retention | Do not enable live reports |
| D1-D11 | Billing | Free / no entitlement gates |

---

## E. Owner response sheet (fill in)

| ID | Owner choice | Date | Notes |
| --- | --- | --- | --- |
| P14-D1-A1 | | | |
| P14-D1-A2 | | | |
| P14-D1-A3 | | | |
| P14-D1-A4 | | | |
| P14-D1-A5 | | | |
| P14-D1-A6 | | | |
| P14-D1-B1 | | | |
| P14-D1-B2 | | | |
| P14-D1-B3 | | | |
| P14-D1-B4 | | | |
| P14-D1-B5 | | | |
| P14-D1-B6 | | | |
| P14-D1-C1 | | | |
| P14-D1-C2 | | | |
| P14-D1-C3 | | | |

---

## F. Implementation freeze rule

Do **not** start persistent writes, migration apply to primary, or kill-switch enablement until **A1–A6** are resolved.  
B-series should be frozen before first P14 teams migration is authored.  
C-series may remain open while foundation ships read-only discovery + gated create/settings only.
