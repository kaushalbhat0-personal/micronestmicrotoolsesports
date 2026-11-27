# P15-A0 — Product, UX, Tools & Shareability Audit

**Date:** 2026-11-28  
**Branch:** `new-platform` @ `890e16cbab0ecc03c2e562e9fe18915bca5e9eff`  
**Mode:** AUDIT ONLY (documentation created; no application or database changes)  
**Production:** `https://micronestmicrotoolsesports.vercel.app`  
**Supabase:** `knniommcyyhbyiwljisk`

## Overall verdict

**READY FOR DISTRIBUTION-FIRST ITERATION — NOT YET A SELF-GROWING NETWORK.**

The new platform already delivers a credible BGMI-first core:

- Frictionless auth + profile onboarding (**VERIFIED**, P14-D10–D14).
- Opt-in player directory and public profiles via frozen G1 projections (**VERIFIED**).
- Team create/edit/directory with hard RPC/RLS authorization (**VERIFIED**).
- Three high-quality, privacy-preserving client-side tools (**VERIFIED**).

It does **not** yet convert utility into organic growth. Export is clipboard text only; there are no branded PNG cards, shareable result links, OG images, or recruitment workflows. Several discovery shells (news, brands, organizations) remain UI-complete without live databases. Product routes are intentionally `noindex`.

## Platform readiness (summary)

| Layer | Readiness | Classification |
|---|---|---|
| Auth / onboarding | High | VERIFIED |
| Player discovery | High (narrow filters) | VERIFIED / PARTIAL |
| Team discovery | Medium-high (no open slots) | VERIFIED / PARTIAL |
| Tools engines | High | VERIFIED |
| Tools shareability | Low | PARTIAL / MISSING |
| Editorial / brands / orgs | Shell / deferred DB | PARTIAL |
| Growth / SEO / OG | Low by design | PARTIAL / MISSING |
| Security posture | Strong; do not weaken | VERIFIED |

## What is already good (preserve)

1. Honest empty states — no fabricated players, teams, tournaments, or metrics.
2. Client-only tools with zero telemetry and no payment custody claims.
3. Public projection RPCs that omit private IDs and forbid verification badges.
4. Soft UI gates that never replace hard `create_team` / RLS checks.
5. Feature-first modular monolith and Arena visual language (Oswald + Geist, crimson accent).

## Biggest product / UX problems

1. **No viral surface** — tools and profiles cannot leave the browser as branded assets.
2. **Recruitment incomplete** — team `recruiting` boolean exists; open-slot / application workflow is orphan UI + Zod only.
3. **Player identity incomplete after create** — no settings UI for game-profile edit, availability capture, or avatar upload (server APIs exist).
4. **Directory filters too thin for matching** — no availability, LFT flag, or recruiting URL filter.
5. **Discoverability vs SEO tension** — product pages `noindex`; growth must come from shares, not organic search of profiles (by current design).

## Recommended first implementation milestone

**P15-M1 — Share Kit v1 (no schema / no RLS changes):**

1. Client-side branded PNG + copy helpers for Prize Pool, Roster, and Tie-Break results (watermark + profile/tools URL).
2. Player “LFT card” PNG generated only from **already-public** projection fields + public profile URL.
3. Team “Recruiting card” PNG from public team fields (`recruiting`, game, region, levels, member_count) + team URL — **no open-slot schema yet**.

Why first: maximum acquisition/distribution upside, low security risk, aligns with operator preference for asynchronous growth, and can support a PMGC-season campaign without official event IP.

## Document index

| File | Contents |
|---|---|
| `01-current-state-inventory.md` | What exists and status |
| `02-tools-audit.md` | Utility-by-utility audit |
| `03-player-team-discovery.md` | Journeys, LFT/LFP field matrix |
| `04-shareability-architecture.md` | PNG, links, watermark, privacy |
| `05-ui-ux-accessibility.md` | UX / WCAG 2.2 AA findings |
| `06-pmgc-opportunity.md` | Time-sensitive campaign assessment |
| `07-security-architecture.md` | Constraints and risks |
| `08-monetization-strategy.md` | Realistic business options |
| `09-prioritized-roadmap.md` | Sequenced recommendations |
| `10-evidence-register.md` | Paths, routes, tests |

## Explicit non-actions

This audit did not implement features, edit application code, mutate Supabase, install packages, commit, push, or deploy. Working tree untracked docs (including P14-D14) were preserved.
