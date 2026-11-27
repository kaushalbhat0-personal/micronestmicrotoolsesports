# 07 — Implementation roadmap

Prioritize **reuse**. Do not rebuild auth, verification architecture, RLS, or G1 projection. Separate by urgency.

## P0 — Essential before campaign launch

| # | Work | Why | Reuses |
| --- | --- | --- | --- |
| P0.1 | FRAGIX brand surface: `siteConfig`, header/footer, metadata, favicon/mark, auth/onboarding strings, share watermark + filename fallback | Cards & ads must say FRAGIX | Existing layout/Share Kit |
| P0.2 | Align verification messaging: remove “nothing is verified” / “not a verification badge” where ownership review exists; use truthful reviewed wording | Trust + loop coherence | Badge reader + settings states |
| P0.3 | Optional ownership-reviewed badge **on** PNG when valid (never gate download); registry search requires valid approval | C1 corrected policy | Public status reader + `search_player_directory` |
| P0.3b | Gate **registry search only** on valid BGMI ownership approval; preserve `is_discoverable` consent; keep `get_player_by_handle` shareable without verification | AC2–AC5 | M2B.1 directory RPCs |
| P0.4 | Identity-first PMGC-neutral campaign landing (evolve `/campaigns/bgmi-season` or thin twin) | Social destination | Existing routes — **DONE in C1C** |
| P0.5 | Durable `platform_admins` + review staffing SLA | Manual review bottleneck | M2B.4 queue — **OPEN (C1D: live admins = 0)** |
| P0.6 | Owner decision: analytics policy (stay zero-telemetry vs minimal aggregate) | Avoid silent tracking | — **OPEN (C1D policy draft in `08`)** |
| P0.7 | Legal freeze: disclaimers, no PMGC marks/assets, no fake stats; Privacy/Terms posture | Campaign risk | Existing disclaimer patterns — **OPEN (C1D `09`)** |

## P1 — During campaign

| # | Work | Why |
| --- | --- | --- |
| P1.1 | Paint public avatar on player PNG | Higher share CTR |
| P1.2 | Optional QR / Web Share API on download | Mobile Instagram path |
| P1.3 | UTM handling on campaign landing (no PII) | Creative attribution |
| P1.4 | Aggregate download / funnel counters if analytics approved | Ops dashboards |
| P1.5 | Settings deep-link “view public card” after discoverability | Reduce drop-off |
| P1.6 | Soften moderation index copy (“queue operational” for BGMI) | Ops UX |
| P1.7 | Ship Concept A/B Reels using real screens | Distribution |

## P2 — Future

| # | Work | Why |
| --- | --- | --- |
| P2.1 | Multi-game identity beyond BGMI | Long-term FRAGIX |
| P2.2 | Richer creator UGC kit / brand guidelines site | Scale |
| P2.3 | Full product analytics suite | After privacy policy update |
| P2.4 | Discord binding (previously deferred) | Only if product reopens |
| P2.5 | Domain cutover / redirects MicroNest → FRAGIX | Infra, separate from app loop |

## Explicit non-goals (all phases unless owner overturns)

- New “campaign tool” product
- Auto-approve / fake verification
- Public BGMI IDs or evidence
- G1 projection widening
- LMS project access
- Dependency sprawl for QR/analytics without decision

## Suggested sequencing

1. ~~P0.1–P0.4 product surface~~ — delivered via **C1A / C1B / C1C**  
2. ~~C1D ops audit~~ — docs complete; **owner actions** still required (P0.5–P0.7)  
3. Soft-launch `/campaigns/bgmi-season` to internal creators **only after** P0.5 if pushing review/registry CTAs; create+share-only soft launch may proceed with owner risk acceptance  
4. P1 content + attribution  
5. P2 brand/domain maturity  
