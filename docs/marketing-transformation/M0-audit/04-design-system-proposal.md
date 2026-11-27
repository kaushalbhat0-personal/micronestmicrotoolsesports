# 04 — Design System Proposal (Direction A: Competitive Esports)

Implemented with Tailwind v4 theme tokens in `globals.css` (no new
dependencies). Names are proposals; exact values locked at implementation.

## Tokens

- Surfaces: `--surface-arena` (near-black `#0A0E14`-class) for hero/bracket
  bands; `--surface-paper` (white) for content; `--surface-steel`
  (`#F1F5F9`-class) for table/muted bands.
- Ink: `--ink` slate-950 body text on paper; `--ink-inverse` white on arena.
- Accent (single hue): `--accent` tournament red; `--accent-hover` darker
  red. Accent usage budget: CTAs, active nav state, keylines, live markers.
- Lines: `--line` slate-200 borders on paper; translucent white borders on arena.
- Radii: small (2–6px) — sharp, scoreboard-like; pills only for chips/tags.
- Spacing rhythm: max-w-5xl container kept; arena bands full-bleed with
  inner container.

## Typography

- Display: condensed uppercase grotesk, weights 700–800, tracking tight,
  for H1/H2/section eyebrows. Fallback stack defined if no webfont is
  procured (system stack with uppercase + tracking still reads competitive).
- Body: current system grotesk retained for readability and zero added
  weight. Mono/tabular numerals for handles, stats, IGNs.
- Scale: H1 clamp(2.5rem→4rem), H2 1.5–2rem, body 1rem/1.625, eyebrows
  0.75rem uppercase tracked.

## Components (marketing-only; app components untouched)

`ArenaHero` (headline + subcopy + two CTAs + live directory strip),
`SectionEyebrow`, `BracketGrid`/`StandingsTable` (feature/audience rows),
`PlayerCardPromo` (reuses projection-shaped data, never real private rows),
`StatStrip` (only live-sourced numbers or no numbers at all),
`CTAButton` (accent solid / outline inverse), `AudienceCard` ×4
(players/teams/orgs/brands with honest availability labels),
`RoadmapStrip` (implemented vs coming-soon, per `02` classification).

## Rules

Marketing components live under `src/app/(marketing)/_components/` and must
never import Supabase clients, `DirectoryReader`, or feature-server
modules — static content only, covered by extending the existing
`routes.test.ts` static-audit pattern. Real directory previews use the same
public RPC path as product pages or ship as static mock shaped exactly like
the frozen projection (never real user rows).
