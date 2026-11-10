# Open Decisions (Product-Owner Approval Required)

> Decision-ready register now lives in `decisions/` (`decision-register.md` D-01–D-19, `recommended-defaults.md`, `architecture-blockers.md`, `scope-freeze-proposal.md`). This file remains the canonical question list; statuses here are unchanged — nothing marked approved.

None of the items below are decided. Each needs an explicit approve / reject / amend.

## Product and scope

1. **[Open]** Title strategy: BGMI-only data with multi-title-ready schema (recommended) vs deeper multi-title content at launch?
2. **[Open]** Recruiter role: distinct org role vs admin flag?
3. **[Open]** Invitations: vacancy-pointer only (recommended) vs any direct contact between strangers?
4. **[Open]** Notifications: in-app only for MVP vs email from day one? If email, provider and templates?
5. **[Open]** Tournament organizers: editorial listing only (recommended) vs self-serve accounts in MVP?
6. **[Open]** Staff recruitment: single generic staff type first vs distinct coach/manager/analyst flows?
7. **[Open]** Paid vs voluntary flag on staff/brand opportunities: required field?
8. **[Open]** Report SLA and strike policy numbers (takedown time, strikes before publishing ban)?
9. **[Open]** Application caps (per-day applications, note length) values?
10. **[Open]** Discovery paywall: is any finder or application flow ever gated? (Recommended: no.)

## Backend and data

11. **[Open]** New-domain tables fresh (recommended) vs migrating legacy finder tables?
12. **[Open]** Legacy tool tables: leave dormant indefinitely vs scheduled cleanup with retention policy?
13. **[Open]** Legacy seed (tools/plans/BMSD data): exclude from new-environment seeds?
14. **[Open]** Live-project parity check: authorize read-only inspection, and who runs it?
15. **[Open]** Auth hardening timeline: local-dev settings adequate for MVP build vs confirmations/OAuth now?

## Architecture and toolchain

16. **[Open]** `next.config.ts` legacy redirects: remove now vs keep until routing lands?
17. **[Open]** `dodopayments`/`razorpay` dependencies: keep vs prune?
18. **[Open]** `db:types` output path and Windows-compatible syntax fix: approve scope?
19. **[Open]** Cron needs: vacancy-expiry sweep and moderation queues — Vercel Cron vs Postgres-scheduled vs manual for MVP?

## How to approve

Reply per item with Approved / Rejected / Amended (with replacement text). Unanswered items block their dependent phases per `mvp-roadmap.md`.
