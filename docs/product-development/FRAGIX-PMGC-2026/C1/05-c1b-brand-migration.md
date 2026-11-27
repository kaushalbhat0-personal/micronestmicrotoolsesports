# 05 — C1B brand surface migration (implemented)

**Status:** Complete — consumer-facing FRAGIX identity applied  
**Branch:** `new-platform` @ `890e16c` (+ dirty worktree preserved)  
**Scope:** Brand / copy / share-kit presentation only — no schema, RPC, auth, or ownership architecture changes

## Locked identity shipped

| Field | Value |
| --- | --- |
| Brand | FRAGIX |
| Category | Global Esports Network |
| Tagline | Where Competition Connects |
| Visual system | Existing Competitive Arena (deep charcoal, steel white, restrained crimson) |
| Mark | Interim geometric **F** (`src/app/icon.svg` + header + share canvas) |

### Logo requirement (open)

Final approved FRAGIX logo asset is **not** in repo. Interim geometric F mark is intentional and documented via `siteConfig.markStatus = "interim-geometric"`. Do not treat the interim mark as the final brand lockup.

## Central configuration

`src/config/site.ts` is the canonical brand source:

- `name`, `tagline`, `category`, `description`, `markStatus`
- Root `layout.tsx` metadata template uses `siteConfig`
- Homepage / about / campaign / footer / header prefer `siteConfig` over scattered literals

## Surfaces updated

| Surface | Change |
| --- | --- |
| Homepage hero | Brand-first **FRAGIX** H1 + tagline; share-vs-registry messaging |
| Header / footer | FRAGIX wordmark, interim F mark, account glyph `F`, legal copy |
| About | FRAGIX identity + accurate availability (PNG ungated, registry gated, ownership live) |
| Login / signup / forgot-password / onboarding | FRAGIX account copy |
| Player registry | Ownership-gated messaging; metadata title “Player registry” |
| Player / team share cards | FRAGIX PNG branding + corrected disclaimers |
| Campaign (`/campaigns/bgmi-season`) | FRAGIX + tagline; registry vs share clarity |
| Tools / directories / news / tournaments / orgs / brands / organizers | Consumer-facing MicroNest → FRAGIX |
| Favicon | Interim F mark SVG |
| Health service id | `fragix` |

## Share Kit

- Canvas watermark: **FRAGIX · Where Competition Connects**
- Interim F mark drawn to match `icon.svg`
- Player PNG: optional ownership-reviewed eyebrow/disclaimer when `ownershipReviewed` is true from the existing public ownership reader
- PNG download remains ungated (no verification requirement)
- Output size remains **1080×1080**
- Filename fallback: `fragix-share`
- Tool/team share disclaimers rebranded to FRAGIX

## Messaging corrections

Removed contradictory “nothing is verified” marketing claims.

Authoritative consumer messaging now:

1. Create and share identity (profile URL + PNG) **without** ownership review.
2. BGMI ownership review is a **separate** process.
3. Ownership-reviewed badge appears **only** when approval is currently valid.
4. Public **player registry** lists only approved + complete + opted-in players (C1A).

## Explicit non-actions

- No database schema or migrations modified
- No auth / ownership verification / RPC / G1 projection changes
- No registry eligibility logic changes (C1A remains authoritative)
- No new dependencies
- No LMS project access
- No commit / push / deploy

## Historical leftovers (intentional)

| Item | Reason |
| --- | --- |
| npm package name `micronest-esports` in `package.json` | Not a consumer surface; rename deferred |
| Reserved registration method `"micronest"` in tournament domain | Internal enum / schema contract — not UI brand |
| Hosted project slug `micronestmicrotoolsesports` | Infrastructure identity; not rewritten |
| `legacy/` references | Reference-only tree |

## Validation

| Gate | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm test` (unit) | **1094** passed |
| `npm run build` | Pass |
| Playwright `e2e/home.spec.ts` + `e2e/players.spec.ts` | **9/9** passed |
| Screenshots 1440×900 + 390×844 | See `evidence/` |

## Evidence

Screenshots under `docs/product-development/FRAGIX-PMGC-2026/C1/evidence/`:

- `home-desktop.png` / `home-mobile.png`
- `about-desktop.png` / `about-mobile.png`
- `login-desktop.png` / `login-mobile.png`
- `signup-desktop.png` / `signup-mobile.png`
- `players-desktop.png` / `players-mobile.png`
- `tools-desktop.png` / `tools-mobile.png`
- `campaign-desktop.png` / `campaign-mobile.png`

## Acceptance checklist

- [x] FRAGIX identity consistent on intended public surfaces
- [x] Existing functionality / security boundaries unchanged
- [x] PNG sharing available without verification
- [x] Badge accuracy path intact (optional flag from public ownership reader)
- [x] No schema or migration changes
- [x] Typecheck, lint, unit tests, build pass
- [x] Playwright smoke pass
- [x] Worktree preserved; no commit / push / deploy

## Verdict

**PASS — C1B brand surface migration complete.**
