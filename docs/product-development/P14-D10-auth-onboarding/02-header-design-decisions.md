# 02 — Header Design Decisions (P14-D10)

## Problem

Desktop showed 9 discovery links + Settings + CTA in one row at `xl` only — crowded,
no auth entry, no session awareness, generic light SaaS bar.

## Direction (Competitive Arena, not generic SaaS)

- Carbon band (`bg-arena-950`, white text) with 2px crimson top keyline; matches footer
  and hero arena bands. Sharp geometry (no radius), Oswald uppercase labels.
- Left: brand mark (white tile, carbon M, crimson underline) + `MicroNest Esports`.
- Center: grouped primary — `Discover ▾` (Players, Teams, Organizations, Organizers,
  Brands with one-line descriptions) + Tournaments, News, Tools, About. 9 items → 5
  top-level. Dropdown is button-controlled (`aria-expanded`/`aria-controls`), closes on
  Escape / outside pointer, menu roles for AT.
- Right (anonymous): `Log in` (ghost/underline) + `Sign up` (solid crimson
  `bg-accent-600 → hover bg-accent-700`). 44px targets, no font-size squeezing.
- Right (authenticated): `Workspace` (outline) + `Account` menu (initial tile, Team
  workspace, Profile settings, Sign out via `POST /logout`). No redundant signup/login;
  no PII in nav (server passes only `signedIn: boolean`).
- Anonymous never sees Settings/workspace links; authenticated never sees signup/login.

## Structure

- `site-header.tsx` (server, orchestration only): `createClient().auth.getUser()` →
  `<SiteHeaderShell signedIn />`. Fail-closed to anonymous.
- `site-header-shell.tsx` (client): all interactivity (Discover, Account, mobile panel).
- Breakpoints: full row at `lg` (was `xl`), mobile panel below `lg`. Panel groups
  Discover / Explore, then stacked auth actions (Sign up solid first, Log in outline;
  authenticated: Sign out). No horizontal overflow (`max-w-6xl`, wrapping flex).

## Stitch

Connected Stitch MCP was not available in this environment; direction implemented from
the existing Competitive Arena tokens and approved composition (carbon band, crimson
CTA, sharp type). No platform redesign beyond the header.
