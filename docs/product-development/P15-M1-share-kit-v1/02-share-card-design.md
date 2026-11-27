# 02 — Share Card Design

## Format

| Property | Value |
|---|---|
| Size | **1080 × 1080** (single default) |
| Background | Arena carbon `#0A0E14` |
| Accent | Crimson keyline / mark bar `#C8102E` |
| Readable accent on dark | `#FF8A96` (eyebrow / watermark URL) |
| Display type | Oswald (with system condensed fallbacks) |
| Body type | Geist / system-ui |
| Mark | Drawn to match `src/app/icon.svg` (no new asset files) |

## Layout structure

1. Brand row (mark + MicroNest Esports)
2. Eyebrow (tool / Discoverable Player / Team status)
3. Title + optional subtitle (truncated / wrapped)
4. Divider
5. Labelled rows
6. Optional blocks panel (standings / slots / short description)
7. Disclaimer
8. Watermark bar: mark + brand name + destination URL

## Card tones

| Tone | Eyebrow examples |
|---|---|
| `tool` | Prize Pool Splitter / Roster / Tie-Break Simulator |
| `player` | Discoverable Player |
| `team` | Team · Open to Recruitment **or** Public Team |

## Accessibility (UI controls)

- Download buttons: `min-h-[44px]`, visible focus rings, descriptive labels.
- Generation status via `role="status"` / `aria-live="polite"`.
- `aria-busy` while preparing PNG.
- Canvas itself is presentational download output; page content remains the accessible source of truth.

## Mobile readability

Square 1080 export scales cleanly in Discord/WhatsApp; text sizes chosen for phone viewing (title ~56px canvas, body ≥18px).
