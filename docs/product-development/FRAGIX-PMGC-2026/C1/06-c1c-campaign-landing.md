# 06 — C1C identity-first campaign landing (implemented)

**Status:** Complete — `/campaigns/bgmi-season` evolved into FRAGIX identity conversion page  
**Branch:** `new-platform` @ `890e16c` (+ dirty worktree preserved)  
**Scope:** Campaign presentation + routing to existing product journeys only

## Objective

Mobile-first conversion surface that turns visitors into FRAGIX player registrations and share-card creators.

**Primary CTA:** Create Your Player Card → `/signup` (default next: `/onboarding/profile`)

## Journey communicated (existing product)

1. Discover FRAGIX  
2. Register or log in  
3. Complete player profile  
4. Optionally submit BGMI ownership evidence  
5. Download / share PNG (ungated)  
6. Registry discoverability only when completeness + consent + valid ownership approval are satisfied (C1A)

## Page composition

Route: `/campaigns/bgmi-season` (evolved in place — no new tool)

| Section | Purpose |
| --- | --- |
| Hero | Brand + locked headline + primary/secondary CTAs + specimen card |
| Your player identity | Share-without-review messaging + CTA |
| How FRAGIX works | 3 steps; ownership review ≠ registration/sharing |
| Competitive community | Real `/players` + `/teams` discovery lanes (no fabricated stats) |
| Campaign CTA | “Your squad is out there.” → Create your FRAGIX identity |
| Tools strip | Secondary season utilities only |
| Legal footer | Unofficial community campaign; no KRAFTON/PMGC affiliation |

## Implementation notes

- Components under `src/app/campaigns/bgmi-season/_components/`
- Specimen card is an **illustrative** HTML composition matching Arena/Share Kit language (interim F mark). Not a real athlete; no invented credentials/stats
- Auth uses existing `/signup` and `/login` (safe `next` allowlist unchanged; signup defaults to onboarding)
- Metadata: title “Create Your Player Card”, Open Graph set, `robots: { index: false, follow: true }` preserved
- Footer nav label updated to “Create your player card”

## Explicit non-actions

- No new tool product  
- No schema / RPC / RLS / auth / ownership architecture changes  
- No PMGC logos, schedules, or affiliation claims  
- No fabricated testimonials or platform statistics  
- No new dependencies  
- No commit / push / deploy  

## Validation

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` (unit) | **1097** passed |
| `npm run build` | Pass |
| Playwright `e2e/campaign-c1c.spec.ts` + `e2e/home.spec.ts` | **6/6** passed |
| Desktop 1440×900 / Mobile 390×844 screenshots | Captured |

## Evidence

Under `docs/product-development/FRAGIX-PMGC-2026/C1/evidence/`:

- `c1c-campaign-desktop.png` / `c1c-campaign-mobile.png`
- `c1c-campaign-desktop-full.png` / `c1c-campaign-mobile-full.png`
- `c1c-how-desktop.png` / `c1c-how-mobile.png`
- `c1c-community-desktop.png` / `c1c-community-mobile.png`

## Acceptance checklist

- [x] Identity creation is the primary action  
- [x] Product policy (share ungated / registry gated) communicated accurately  
- [x] Working links only (`/signup`, `/login`, `/players`, `/teams`, tools)  
- [x] Unofficial campaign framing; no official PMGC affiliation  
- [x] No new product functionality  
- [x] Quality gates pass  
- [x] Worktree preserved  

## Verdict

**PASS — C1C identity-first campaign landing complete.**
