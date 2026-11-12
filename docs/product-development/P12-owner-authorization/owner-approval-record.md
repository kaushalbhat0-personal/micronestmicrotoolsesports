# Owner approval record (APPROVED P13-A with qualifications — see notes)

Original P12 template preserved below; P13-A owner decisions recorded
2026-11-12 without inventing any person's name or signature. Deferred items
stay deferred; nothing deferred is implemented in P13-A.

| ID | Decision | Status | Owner | Date | Note |
| -- | -------- | ------ | ----- | ---- | ---- |
| D-01 | Independent organizers | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Independent registry + founding owner |
| D-02 | Organization linkage (dual-consent, post-launch) | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Model approved; implementation deferred, linkage stays null |
| D-03 | Professional class deferred | DEFERRED | Owner (recorded P13-A) | 2026-11-12 | Vocabulary retained, no professional trust badge |
| D-04 | Moderation authority + SLA + queue rules + takedown | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Platform-admin authority, governance, separation, SLA per P12 |
| D-05 | Verification policy (evidence, retention, approvers, expiry) | DEFERRED | Owner (recorded P13-A) | 2026-11-12 | No verification activation, evidence upload, or workflow in P13-A |
| D-06 | Supabase CLI/MCP verification route | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Inspection + controlled migration workflow authorized. No Docker, no second project. NOT permission to blindly reset or destroy data |
| D-07 | Rejection as return-to-draft with reason | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Mandatory reason in append-only decision audit |
| D-08 | Archival retention duration | APPROVED | Owner (recorded P13-A) | 2026-11-12 | No hard delete; retain per approved retention policy |
| D-09 | Media/evidence uploads deferred | DEFERRED | Owner (recorded P13-A) | 2026-11-12 | No media or evidence uploads |
| D-10 | Organizer filter (in principle, post-launch) | APPROVED IN PRINCIPLE | Owner (recorded P13-A) | 2026-11-12 | Deferred until after launch |
| D-11 | F-03 admin-provisioned bootstrap power | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Audited admin provisioning; no public self-claim |
| D-12 | F-02 strict default (exceptions named, if any) | APPROVED | Owner (recorded P13-A) | 2026-11-12 | All 20 fields frozen, no exceptions |
| D-13 | Retention + SLA table | APPROVED | Owner (recorded P13-A) | 2026-11-12 | P12 retention and SLA proposal adopted |
| D-14 | One-switch-at-a-time discipline | APPROVED | Owner (recorded P13-A) | 2026-11-12 | Evidence for every enablement; all switches stay OFF in P13-A |

Minimum for any activation: D-04, D-06, D-11, D-12. Verification features
additionally require D-05 (DEFERRED — not activated). Approvals recorded:
**10** full + D-10 in principle; D-03/D-05/D-09 deferred. P13-A state pinned by
`src/features/moderation/tests/p12-activation-proposal.test.ts`.
