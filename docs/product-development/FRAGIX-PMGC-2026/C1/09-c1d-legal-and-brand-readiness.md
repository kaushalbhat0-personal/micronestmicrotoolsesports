# 09 — C1D legal and brand readiness

**Status:** Audit — separates **verified product facts** from **questions requiring professional legal review**  
**Constraint:** This document is **not** legal advice and does **not** claim trademark clearance.

## A. Verified product / repo facts

### Privacy policy & terms of service

| Item | Finding |
| --- | --- |
| Active App Router `/privacy` | **Missing** |
| Active App Router `/terms` | **Missing** |
| Footer links to terms/privacy | **None** (explicitly avoided in `site-footer.tsx` comments) |
| Legacy only | `legacy/application/src/app/privacy/page.tsx` and `terms/page.tsx` exist as **reference-only** — not shipped on the new platform |

**Fact:** Controlled campaign would currently operate **without** linked consumer ToS/Privacy pages on the live FRAGIX surface.

### BGMI ownership-review disclosure

| Surface | Fact |
| --- | --- |
| Settings discoverability | States registry needs approved ownership + matching Player ID; share/PNG ungated |
| Settings ownership UI | Statuses include pending / approved / rejected / withdrawn / id_mismatch; player-facing reject copy only |
| Public badge label | “BGMI ownership evidence reviewed” (not “BGMI verified”) |
| Campaign / about / footer | Independent of KRAFTON; ownership-reviewed ≠ publisher validation |

### Public registry eligibility disclosure

Documented in C1 policy + player registry copy + campaign how-it-works: completeness + consent + valid ownership approval. C1A enforces search gate in DB.

### Verification badge terminology

| Allowed (product) | Forbidden (product risk) |
| --- | --- |
| BGMI ownership evidence reviewed | BGMI verified / PMGC verified / officially verified |
| Ownership-reviewed badge | Verified player (unqualified) |
| Manual FRAGIX review | Endorsed by KRAFTON |

### FRAGIX brand assets

| Item | Fact |
| --- | --- |
| Consumer name / tagline / category | Shipped via `siteConfig` (C1B) |
| Logo | **Interim geometric F** only (`markStatus: interim-geometric`) |
| Final approved logo file | **Not in repo** |
| Trademark registration / assignment docs in repo | **None found** |
| npm package name | Still `micronest-esports` (non-consumer) |

### PMGC non-affiliation

Campaign page and footer state unofficial community campaign; not affiliated/sponsored/endorsed by KRAFTON or PMGC organizers. No PMGC logos/schedules in campaign route. Creative plan (`06-social-video-content-plan.md`) forbids official marks/broadcast footage.

### Asset & music licensing (campaign creatives)

| Item | Repo fact |
| --- | --- |
| PMGC / BGMI official artwork in app campaign route | Not used |
| Music / SFX licenses for Reels | **Not documented in product repo** — creative ops must track outside |
| User PNGs in showcase | Requires player permission (see ops doc) |

### UGC / takedown

| Capability | Fact |
| --- | --- |
| Player profile deletion / ownership evidence cleanup | Implemented (P15) |
| Formal public “report / takedown” consumer policy page | **Not shipped** |
| Moderation shells (reports/tournaments) | Partial / not the BGMI ownership path |
| BGMI evidence retention after reject | Known gap (M2B.4) — needs owner retention decision |

## B. Questions requiring professional legal / brand counsel

These are **not** answered by engineering:

1. Adequacy of operating without published Privacy Policy / Terms for the campaign jurisdiction(s).  
2. Whether FRAGIX name/mark can be used commercially (search, filing, conflicts).  
3. Whether interim geometric F mark is acceptable publicly before final lockup.  
4. BGMI / KRAFTON trademark fair-use boundaries for “BGMI” in marketing beyond current disclaimers.  
5. PMGC “unofficial community” positioning under organizer IP / sponsorship guidelines.  
6. Cross-border processing of evidence images (India / other) and retention periods.  
7. Age gate / parental consent for young competitive audiences.  
8. Music, font, and stock licensing for paid social.  
9. DMCA / local takedown process wording.  
10. Whether campaign page should remain `noindex` for paid traffic.

## C. Soft-launch legal posture (engineering recommendation only)

**Minimum before any paid push:** counsel sign-off or explicit owner risk acceptance on: Privacy/Terms presence, FRAGIX naming, PMGC non-affiliation creatives, evidence retention.

**Minimum before accepting ownership evidence at scale:** same, plus reviewer SLA and evidence retention policy.

## Legal / brand area verdict

**CONDITIONALLY READY for soft/internal traffic.**  
**Not READY for paid/public distribution** until Privacy/Terms (or accepted interim notice), trademark posture, and creative licensing are owner-cleared.
