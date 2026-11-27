# 01 — Current brand inventory

## Canonical brand today

| Source | Value (evidence) |
| --- | --- |
| `src/config/site.ts` | `name: "MicroNest Esports"` |
| `package.json` | `name: "micronest-esports"`; description MicroNest |
| Root layout metadata | Uses `siteConfig.name` / description |
| `src/app/icon.svg` | “M” mark (carbon + crimson bar) — MicroNest monogram |
| Share Kit mark | `drawMark()` mirrors `icon.svg` “M” geometry (`src/lib/share-kit/render.ts`) |

**FRAGIX:** no matches in `src/` for `FRAGIX` / `fragix` / tagline “Where Competition Connects.”

## Surface map (MicroNest references)

| Area | Evidence |
| --- | --- |
| Header | `aria-label="MicroNest Esports — home"`; displays `siteConfig.name` (`site-header-shell.tsx`) |
| Footer | “About MicroNest”; BGMI trademark disclaimer naming MicroNest (`site-footer.tsx`) |
| Home | Title/OG “MicroNest Esports — Where esports talent gets discovered” (`page.tsx`) |
| About | “About MicroNest Esports” (`about/page.tsx`) |
| Auth | Signup/login/forgot-password copy & metadata say MicroNest |
| Onboarding | “Create your MicroNest player profile…” |
| Campaign | `/campaigns/bgmi-season` eyebrow “MicroNest Esports”; pathways say “live MicroNest route” |
| Share Kit | Watermark/brand row uses `siteConfig.name`; fallback filename `micronest-share` |
| Player share disclaimer | “…Discoverable in the MicroNest Esports directory.” |
| Team/tool share | “Generated with MicroNest…” / MicroNest Tie-Break |

Rough count: **40+** `src/**/*.{ts,tsx}` files still name MicroNest (excluding legacy).

## Visual system (current)

| Token | Observation |
| --- | --- |
| Display font | Oswald (`layout.tsx`) |
| Body font | Geist |
| Arena palette | Carbon `#0A0E14`, crimson `#C8102E` (`share-kit/colors.ts`, marketing) |
| Personality fit vs FRAGIX brief | Aggressive / competitive / gaming-native **partially** met by Arena treatment; brand name and “M” mark are MicroNest, not FRAGIX |

## Campaign page brand posture

`/campaigns/bgmi-season` correctly avoids official event affiliation claims and includes trademark independence copy. It is still **MicroNest-branded** and **tools-primary**, not FRAGIX identity-primary.

## Implication for FRAGIX

Brand migration is a **presentation + copy + asset** project (config, header/footer, metadata, share watermarks, icon/mark, campaign landing). It must not touch verification RLS/architecture. Priority: **P0** before public FRAGIX campaign creative.
