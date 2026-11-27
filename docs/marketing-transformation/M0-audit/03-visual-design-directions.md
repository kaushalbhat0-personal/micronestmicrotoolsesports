# 03 — Visual Design Directions

Locked product-owner direction: **Competitive Esports** (professional
esports organizations and gaming platforms as reference). All three
directions are evaluated against it; the recommendation stays rooted in
competitive esports identity. Shared discipline for every direction: no
neon overload, no generic gradients/glows, no decorative effects without
function, no fabricated credibility.

## Direction A — Competitive Esports (LOCKED, recommended)

- Rationale: speaks the visual language of tournament broadcasts and pro-org
  sites — the audience's home turf. Authority comes from structure and
  restraint, not effects.
- Color: near-black ink (`#0A0E14`-class) surfaces with paper-white content
  areas; single signal accent (tournament red `#E11D2E`-class) reserved for
  CTAs, live states, and keylines; steel grays for metadata. Strict
  accent budget: one hue, used sparingly.
- Typography: condensed, uppercase display face for headlines/scores
  (e.g. Archivo Expanded/condensed grotesk or system fallback stack with
  tight tracking + uppercase), neutral grotesk for body. Big numerals,
  bracket-like rules, tabular figures for stats.
- Layout: editorial brackets and rails — standings-table grids, fixture-like
  rows, bracket-rail sidebars, one full-bleed "arena" hero with real product
  content (live directory preview), not decoration.
- Imagery: real product surfaces (directory cards, profile pages),
  match-inspired photography/illustration only if licensed or generated for
  the brand; player-card motifs drawn from the actual 12-column projection.
- Motion: snappy, scoreboard-like state changes (150–250ms), skeleton
  streaming already in place; no ambient animation, no parallax.

## Direction B — Broadcast Studio

- Rationale: lower-third graphics, stat-ticker energy; feels like watching
  coverage of the ecosystem.
- Color: deep navy studio background, white type, one electric accent for
  "LIVE"-style markers.
- Typography: heavy grotesk headlines, mono for data tickers.
- Layout: ticker strips, split-screen feature blocks, scorebug-style chips.
- Imagery: ticker/stat-cards derived from real directory data.
- Motion: ticker crawl + card flips; higher motion budget, higher risk of
  gimmick fatigue and reduced trust.
- Verdict vs locked direction: adjacent but noisier; recommended only as a
  source of components (stat strips), not the base.

## Direction C — Clubhouse Minimal

- Rationale: premium SaaS-grade restraint; lets product screenshots carry
  the page.
- Color: paper white, ink text, single restrained accent; generous whitespace.
- Typography: neutral grotesk throughout, quiet hierarchy.
- Layout: centered narrow column, alternating feature rows.
- Imagery: product UI captures only.
- Motion: minimal fades on scroll into view.
- Verdict vs locked direction: safe but generic — fails the
  "distinctive, purpose-built for esports" objective and is
  indistinguishable from SaaS templates the brief forbids.

## Recommendation

**Direction A — Competitive Esports**, implemented with Broadcast restraint:
arena hero with real directory content, bracket/table layout language,
single red accent on near-black + white, condensed uppercase display type,
zero decorative effects. Feasibility is high: pure Tailwind + CSS, no new
dependencies, no imagery procurement required for the first pass (product
UI is the visual).
