# 05 — Information Architecture

## Principle

Marketing routes persuade; product routes prove; app routes manage. No
marketing route reads private data or requires a session.

## Marketing (static, no session)

- `/` — home: arena hero (real product promise + directory link), audience
  four-up (players active; teams/orgs/brands labeled "Coming soon"),
  how-it-works (create profile → go discoverable → get discovered),
  live directory preview strip, trust/consent band, FAQ, final CTA.
- `/players` (existing product page, linked as proof — not restyled beyond
  header/footer alignment in this plan).
- `/about` — ecosystem positioning + content-accuracy statement.
- Future (only when the domains ship): `/teams`, `/organizations`,
  `/brands`, `/opportunities`, `/news`, `/tournaments`. No stubs, no dead
  nav items: unshipped sections appear only inside the home RoadmapStrip.

## Authenticated workspace (unchanged)

`/settings/profile` and all future authed routes stay outside marketing
navigation; header shows them only in session-aware states (G1-8B scope).
The "Opportunities" span is removed until a real route exists.

## Navigation

Header: brand mark · Players · About · [CTA: Explore players]. Footer:
platform line + consent/privacy note + route index. One CTA vocabulary:
"Explore players" (exists) vs "Coming soon" (does not). No signup CTA
until G1-8B auth flows ship.
