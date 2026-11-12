# 03 — About Page Implementation (M2, Gate 3)

`src/app/about/page.tsx` — static, prerendered (`○ /about` in build output).
Own metadata (title `About the platform`, honest description, canonical +
OG like home, no OG images). Single H1, hierarchical H2s.

## Sections

- **Arena intro**: H1 `About MicroNest Esports`, one-paragraph definition
  (connected discovery ecosystem; four audiences; BGMI-first,
  multi-title-ready), CTAs `Explore players` → `/players`, `Back to home`
  → `/`.
- **The problem** (`#problem`): `Esports discovery is fragmented` — three
  plain statements (players invisible, teams scout blind, orgs/brands guess).
  No invented anecdotes, companies or data.
- **The vision** (`#vision`, steel): `One place where the ecosystem meets` +
  consent-first line + four audience rows each badged `Live now` (players)
  or `Coming soon`.
- **Game direction** (`#bgmi-direction`): `BGMI-first, multi-title-ready` —
  launch rationale, catalogue mechanics, explicit
  `No exclusivity is implied and no competitive claims are made.`
- **Availability statement** (`#availability`, steel): a 7-row contract —
  directory, profiles, consent/visibility, avatar/handle/deletion = `Live
  now`; team/org/brand discovery, opportunities/workflows, tournaments/news/
  mini games = `Coming soon`. `This page is the contract.`
- **Closing**: reused `ClosingCTA` with about-specific title/copy pointing at
  the live directory.

## Gate 3 check

Explains what the platform is, the fragmentation problem, the ecosystem
vision, the four audiences, and the BGMI direction. No company history,
founders, achievements, statistics, partnerships or testimonials appear
(enforced in `marketing.test.tsx`: `testimonial|sponsor|partner logo` absent
from sources and rendered HTML).
