# P3 Security Report

## Data boundary

- **Proposed-RPC-only reads.** Routes read through `searchTournaments` /
  `getTournamentBySlug` (anon-safe, identity-free). Static audit
  (`routes.test.ts`) fails on any `.from("…")` table access or
  `public.tournaments/…` reference in route sources, any service-key/client
  usage, and any owner/payment/operations token in the render surface.
- **Strict output mapping.** Ordered key-set assertions (14 search + 3
  detail keys); extra keys fail closed. Hostile registration URLs, bad
  money shapes, inverted dates, `verified: true` flags, and overlong
  contact text each fail the row closed. Contact text capped at 500 chars.
- **Fail-closed discovery.** Unknown games pass through to zero rows;
  malformed regions for known games rejected pre-RPC; invalid URL params
  dropped + named; pagination bounded (24/page, 42 max); query ≤120 chars.
  Missing/unpublished slugs → identical 404. Errors generic, no PostgREST
  detail.
- **External-link safety.** Registration URLs re-validated at the reader
  (https-only) and rendered verbatim with `target="_blank"
  rel="noopener noreferrer"` plus a leaves-site notice. No URL rewriting,
  no credentialed URLs, no javascript:/data: schemes possible.

## Write boundary

- **Kill switch ON** (`TOURNAMENT_WRITES_ENABLED: boolean = false`,
  audit-pinned). Validated ops throw before any table touch; no fake
  success. No server actions, no mutations, no form targets in routes;
  publish form has no action and a disabled submit. No service-role
  anywhere in the vertical.

## Impersonation, verification, moderation

- No organizer impersonation path: organizer is display data, never
  authority; no org reads/checks; kind does not gate anything.
- No fake verification: literal `false` in schema + mapping rejection of
  `true`, trust note on every organizer surface.
- No moderator permissions: no report/moderation code, no buttons to
  nowhere; the boundary is stated in UI copy and gated in docs.

## Non-regression

Zero G1/P1/P2 files modified except additive header/footer nav links.
Full suite green: 51 files, 541 passed (82 new P3). Typecheck, lint (one
pre-existing-style unused-import warning fixed), production build clean.
No legacy imports; no migrations created/applied; no commits.
