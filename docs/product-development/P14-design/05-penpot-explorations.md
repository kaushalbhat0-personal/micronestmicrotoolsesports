# 05 — Penpot / Stitch Explorations

## Penpot MCP

- Status: NOT connected. Active `opencode.jsonc` servers: `supabase, vercel, stitch, playwright, browser-use` (`opencode mcp list` = 5 connected). No `penpot` entry.
- Evidence: `C:\Users\91866\.config\opencode\opencode.jsonc.bak-manual` contains a `penpot` remote (`https://design.penpot.app/mcp/stream?userToken=…`) + `rea` local — not in active config. Per constraints (no silent installs/config changes), Penpot was NOT enabled in B1.
- Action: use Stitch MCP (connected, primary per brief) for all visual exploration. Penpot enablement is a B2 decision (requires user token + config change).

## Stitch MCP — capabilities inspected

18 tools via `search({namespace:"stitch"})`: `list_projects`, `create_project`, `get_project`, `list_screens`, `get_screen`, `generate_screen_from_text`, `generate_variants`, `edit_screens`, `create_design_system`, `update_design_system`, `apply_design_system`, `create_design_system_from_design_md`, `upload_design_md`, `update_project`, `update_screen`, `delete_project`, `list_design_systems`, `download_file`. No inventing tool names; schemas read before calls.

## Project + design system (actual)

- Project: `MicroNest Esports - P14-B1 Design Reconnaissance` — `projects/7199013429647347145` (MCP origin, PRIVATE). View: https://stitch.withgoogle.com → project `7199013429647347145`.
- Base design system: `assets/6707774341234228196` (`MicroNest Direction A - Competitive Arena`, LIGHT, INTER/OSWALD, `#C8102E`, ROUND_EIGHT).
- Generated system: `assets/90baed1527db44968f7a931b98380bd0` (`Competitive Arena`, Geist/Oswald, LIGHT/FIDELITY, overrides `primary #0A0E14 / secondary #C8102E`). Full `designMd` in Stitch; key rules: 0px radius, 1px slate borders, no shadow, red ≤5%, 44px targets, Oswald uppercase + tabular data.

## Screens generated (2 of 6 in B1)

1. Homepage (Direction A) — `screens/4b778e90b33a447a8221674bde14935e` (DESKTOP, h 8474). Prompt covered: sticky nav, arena hero + live directory proof, how-it-works, BGMI band, pathways table, roadmap Planned-only, closing CTA, `max-w-5xl`, 44px, landmarks, no gradients/glow/emoji. HTML: `projects/7199013429647347145/files/94803043dbed4ff09106380334173f45`.
2. Player directory — `screens/a96714bf401a4c62ad6789136b3fbe5a` (DESKTOP 2560, h 3898, `MicroNest Esports - Discover Players (BGMI Directory)`). Steel filter bar (Game=BGMI locked, Role/Region/Trust/Sort), 44px table (HANDLE/IGN/GAME/ROLE/REGION/STATS/TRUST/ACTION), Live/Verified vs Community badges, pagination `1–15 of 1,820` (placeholder), empty/loading/error previews. HTML: `files/e1229e1e2572462083be4fc694f96c3b`; screenshot: `files/e796239e51c2424bb43a6a296e0db502`.

## Queued prompts (B2, same project + `assets/6707774341234228196`)

3. Player profile: dossier header (handle/IGN/game/role/region/trust/completeness) + game-visibility + stats radar + related players. 4. Tournament directory: Game/Format/Region/Status filters + tournament-card table + detail composition. 5. News listing + article: kicker/headline/dek/meta index + `article-body` 65ch + related. 6. Tools directory + workspace: tool-card grid + runner workbench (inputs/live output/export) with `role=status`. Each: DESKTOP + MOBILE variant, no invented partnerships/sponsors.

## Audit of Stitch output (do not ship as-is)

- Placeholders are illustrative (handles, KD, counts like `1,820`). Must NOT be treated as product data; implementation binds only to `*-reader`/`query.ts` contracts.
- Check before build: contrast (red-on-dark decorative only), 44px targets, focus-visible, landmarks, `aria-hidden` ghost numerals, reduced-motion, responsive reflow (side-by-side → stacked; tables → sticky-first-col scroll), no `transition-*` bloat.
- Visual language is consistent across both screens (0px, 1px borders, arena bands) — approved base for Direction A iteration via `generate_variants`/`edit_screens` in B2.
