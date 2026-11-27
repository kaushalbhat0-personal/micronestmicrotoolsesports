# 08 — Design System Proposal (Direction A base)

## Principles

1. Honesty over decoration (Live vs Planned labeling stays). 2. Density with 44px targets. 3. One red (`#C8102E`) ≤5%. 4. System stack today, licensed face later without component churn. 5. Product inherits marketing tokens (fix current slate-default gap).

## Tokens (`globals.css` @theme extension, B2)

- Keep: `arena/paper/steel/ink/accent/ghost`, `font-display`. Add: `--color-line` (`#94A3B8` light / `#1E293B` dark-edge), `--color-ink-subtle #64748B`, `--radius-none 0px` (enforce), `--shadow-none`, spacing `4/8/16/24/40`, container `5xl` (marketing) / `7xl` (directories), `--breakpoint-*` defaults documented.
- Type scale: display `56/40/24/18` Oswald uppercase; body `16/14/12`; labels `14/12/10` uppercase `0.06–0.1em`; tabular numerals for stats.
- States: `accent-600` default CTA text/border on light (5.88), white on `accent-600` (5.88), hover `accent-700` (7.82); on arena use `accent-300`/paper text, red decorative only.

## Components (single source)

- Primitives: `Button` (`primary arena / secondary red / ghost`), `Input/Select` (44px, 1px border, focus `outline ink + 2px red bottom`), `Chip/Badge` (`steel` vs `arena+red stripe Live`), `Pagination` (existing a11y pattern), `Card` (`white+1px+32px arena band`, hover red edge), `Table` (44px rows, zebra, hover red bar), `Dialog/Menu` (Radix + 160ms presence), `Skeleton` (`animate-pulse` blocks), `Empty/Error` (`role=status/alert` copy).
- Patterns: `DirectoryShell` (title + live line + steel filter bar + results + pagination), `ProfileHeader` (identity + trust + completeness), `ArticleBody` (65ch), `ToolRunner` (inputs/live output/export + status).
- Icons: activate `lucide-react` (already dep) 16–20px stroke; keep `BrandMark` SVG.

## Multi-title readiness

Game switcher facet (BGMI locked first, others Planned), `game-catalog` drives labels; no hardcoded game styles. Trust tiers (`Verified/Community`) are first-class badges, not color-only.

## Governance

- `design.md` lock (fonts/palette/framework) per Hallmark pre-flight; `sloplint`-style checks at 8 widths + fresh-context review before B2 build.
- No Mini Games tokens/components. No invented data in stories/fixtures.
