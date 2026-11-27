# 08 — Risk and acceptance checklist

## Legal / brand risks

| Risk | Mitigation | Gate |
| --- | --- | --- |
| Implied official PMGC sponsorship | Neutral “community / unofficial” language; no logos/broadcast/IP | Must pass before ads |
| Implied official BGMI verification | Keep “ownership evidence reviewed” wording; never “BGMI verified” | Must pass |
| Trademark misuse (BGMI/KRAFTON) | Retain footer/campaign attributions | Must pass |
| Fabricated standings/player stats | Only self-reported public projection + tool simulations labeled as such | Must pass |

## Security / privacy risks

| Risk | Mitigation | Gate |
| --- | --- | --- |
| Evidence or Player ID in creative | Forbidden in videos/screenshots | Must pass |
| Weakening RLS for speed | Out of scope — reject | Must pass |
| Silent analytics / PII | Owner analytics decision (P0.6) before any SDK | Must pass |
| Reviewer capacity collapse | `platform_admins` + queue staffing | Must pass |

## Product acceptance before “campaign live”

- [x] FRAGIX name/mark on header, footer, metadata, share watermark (C1B)
- [x] Campaign landing CTAs: signup → profile → evidence → share (C1C)
- [x] Homepage/campaign copy no longer claims “nothing is verified” without nuance (C1B/C1C)
- [x] Approved players: public badge **and** share card reflect ownership-reviewed (truthful) (C1B)
- [x] Share card still excludes BGMI ID / evidence
- [x] G1 projection still exactly 12 fields
- [ ] At least one durable super-admin can operate `/workspace/moderation/bgmi-ownership` (**C1D: live = 0**)
- [x] Disclaimers present on campaign + share surfaces
- [x] No official PMGC assets in repo or ad creatives (campaign route)
- [ ] Analytics approach documented and approved (including “none”) — **documented in C1/08; owner approval pending**
- [ ] Privacy Policy / Terms linked on consumer surface — **missing (C1/09)**

## Audit meta (this deliverable)

- [x] Docs-only under `docs/product-development/FRAGIX-PMGC-2026/`
- [x] No source/DB/config/dependency changes for this audit
- [x] Dirty worktree otherwise preserved
- [x] Findings tied to repository evidence
- [x] Roadmap prioritized P0/P1/P2; no implementation in this milestone

## Verdict reminder

**CONDITIONALLY READY** (C1D) — controlled create+share soft launch possible with owner risk acceptance; review/registry-volume and paid push wait on P0.5–P0.7 owner actions.
