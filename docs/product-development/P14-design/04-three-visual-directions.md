# 04 — Three Visual Directions

All directions respect: BGMI-first multi-title-ready, consent-first copy, 44px targets, `font-display` system, no purple gradients/glow/emoji/generic cards. Real structures only.

## Direction A — Competitive Arena (evolution, RECOMMENDED)

- Personality: precise, authoritative, broadcast-scoreboard. Brutalist sports minimalism + dense editorial tables.
- Palette: `paper #FFF` ground, `steel #F1F5F9` modules, `arena-950 #0A0E14` bands/nav, `accent #C8102E` ≤5% (Live, primary action edge), slate borders `#1E293B/#94A3B8`. Light-only.
- Typography: Oswald uppercase display (`tracking 0.02–0.1em`) + Geist/Inter body + tabular numerals. Display `56/40/24/18`, body `16/14/12`, labels `14/12/10` uppercase.
- Surfaces/borders: 0px radius, 1px hard borders, planar tiers (no shadow). Dark bands use 1px `#1E293B` dividers, red only on active edge.
- Imagery: no photography; illustrative format panels (directory schema), telemetry radar (1px axes, red 15% fill), monospaced data tags. Future: licensed match photography, credited.
- Navigation: sticky `paper/95 blur` bar, 9 links + Settings utility + `Explore players` solid CTA; mobile stacked panel.
- Homepage hero: dark arena grid `1.05fr/0.95fr`: left eyebrow + H1 + sub + dual CTA + `Live now` line; right live directory proof (`dl` Handle/IGN/Game/Role·Region) with `Live` pill.
- Player/team: dense 44px-row tables, `arena-950` header row (white Oswald), zebra `white/steel`, hover left 4px red bar; cards `white+1px border+32px arena top band`.
- Tournament discovery: filter steel bar (Game locked BGMI, Format, Region, Trust, Sort) + table + status chips (`Live` black+red stripe / `Planned` steel).
- News: editorial list (kicker, headline, 2-line dek, meta) + `related-stories`; no cards-in-cards.
- Tools workspace: console rows + runner panels (input 44px, `focus: 1px ink + 2px red bottom rule`), `role=status` feedback, skeleton bars.
- Motion: flat, instant; hover color only; row indicator slide 120ms; dialog fade/scale 160ms. Reduced-motion: static.

## Direction B — Editorial Tribune

- Personality: premium sports desk; trustworthy, readable, print-informed.
- Palette: paper `#FFFDF9`, ink `#14120F`, accent deep maroon `#7A0E1F`, gold rule `#C9A227` (thin rules only), steel `#F4F1EA`.
- Typography: Newsreader/Source Serif headlines (sentence case) + Public Sans body + Oswald micro-kickers. Larger leading (1.6), measure ≤68ch.
- Surfaces: 2px radius, hairline rules, generous whitespace, drop-cap on features. No dark bands except score strip.
- Imagery: licensed editorial photography (stadium, stage, crowd — landscape 16/9, credited); avatar initials as fallback; no illustration blobs.
- Navigation: masthead centered wordmark + section links; thin gold rule; date/edition line.
- Hero: headline + lede + byline + hero image (caption/credit) + `Live directory` rail.
- Player/team: profile as article header (name, handle, role/region, trust note) + stat pull-quotes + timeline.
- Tournament: fixture lists like match reports (date, stage, teams, venue).
- News: classic index + article body (`article-body`, 65ch, H2/H3, pull-quote, related).
- Tools: forms as “desk calculators” with serif numerals, print-friendly.
- Motion: page fade 200ms, image reveal clip, underline link anims. Quiet.

## Direction C — Operations Deck

- Personality: organizer/operator tool; dense, keyboard-first, telemetry-driven.
- Palette: slate `#0F172A` shell + steel workpanels + accent blue `#1D4ED8` for actions, red reserved for destructive/live-critical. Light work area + dark command rails.
- Typography: Inter body + JetBrains Mono data + Barlow Condensed headers. Tabular everything.
- Surfaces: 6px radius panels, 1px borders, subtle inset dividers, command palette (`⌘K` style but accessible button).
- Imagery: sparklines, slot grids, bracket rails (SVG); no photography in workspace.
- Navigation: left rail (Discover, Tournaments, News, Tools, Workspace) + top context bar (game switcher BGMI-first, env badge).
- Hero: status board (Live counts, sync state) + quick actions (New tournament, New article, Open tools).
- Player/team: dossier split (left identity + trust, right telemetry tabs, radar).
- Tournament: bracket + registration pipeline columns.
- News: queue table (Draft → Review → Published) + editor.
- Tools: 3-column workbench (inputs, live output, clipboard/export), `progressbar`/`alert` live regions.
- Motion: layout animations for column reorder, drawer slide 220ms spring, skeleton shimmer (disabled under reduced-motion).

## Recommendation

Ship **A** as base (matches built tokens/copy/tests, lowest risk, BGMI broadcast credibility). Borrow B's article measure/typography for News, C's workbench density for Tools/Workspace. Stitch exploration in 05 tests A first.
