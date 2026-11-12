# P1 Implementation Record — Teams & Discovery

## 1. Scope delivered

### 1.1 Teams discovery (`/teams`)

- Team search (name/slug substring, server-escaped SQL-side per D1.5.1 §H).
- Game filter (supported catalogue only — BGMI today; unknown keys fail
  closed to zero rows with an explained empty state).
- Region filter (BGMI vocabulary; malformed regions for known games rejected
  pre-RPC with an explained empty state, indistinguishable from no-results).
- Team level display with a mandatory **self-reported** label and the
  `SELF_REPORTED_LEVEL_NOTE` wherever levels appear (D1-D6 pending).
- Recruiting status badge (open / not recruiting) on every card and the
  detail page. No recruiting URL filter exists because the D1
  `search_teams` RPC exposes no recruiting parameter — none was invented
  (would break pagination honesty).
- Bounded pagination: page size 24, max page 42 (offset 984 ≤ SQL ceiling
  1000), +1 over-read for next-page detection, no totals.
- Empty states (no-results vs filtered-no-results) and error states
  (invalid-filter vs unavailable). No team records or statistics invented.

### 1.2 Team detail (`/teams/[slug]`)

- Identity (initial-letter mark — no logo column exists in D1, no imagery
  invented), game association, description (or explicit placeholder),
  region, current/target levels (self-reported), recruitment status.
- Roster presentation: public member **count** plus an explicit note that
  public roster identities are unavailable (member-private under D1 RLS).
- Public information only. 404-equivalence for missing/private slugs.
  Metadata derived from the projection card only.

### 1.3 Team creation and management UX (`/teams/new`)

- Complete form: name, slug (pattern-hinted, permanent-after-creation note),
  game selection (supported catalogue), description (1000-char bound),
  region, game-specific BGMI roles vocabulary referenced via the existing
  contracts, availability/recruitment presentation (recruiting + visibility
  toggles).
- Validation layer reuses the existing `teamSchema`/`teamSlugSchema` Zod
  boundaries (field constraints mirrored as native input attributes).
- **No write path:** no form action, disabled submit, explicit boundary
  notice naming migration acceptance + captain-authority approval as the
  blockers. No fake success state.

### 1.4 Recruitment experience foundation

- `RecruitmentPostCard`: role needed, slots, level minimum + target
  (self-reported), region, tryout requirement, lifecycle status badge, and a
  readable eligibility/requirements list. No scores (frozen matching rule).
- `ApplicationForm`: optional 200-char note field per `applicationSchema`;
  disabled submit + boundary notice (D1-D3/D1-D12). No applicant data shown.
- `ApplicationStatus`: own-applications-only presentation with an honest
  empty state and a never-public privacy note. No captain decisions, no
  roster insertion, no ownership transfer, no unauthorized membership
  changes — none rendered, none wired.

### 1.5 Multi-esports compatibility

- Game options and display names resolve through
  `src/lib/game-catalog/catalog.ts` (`SUPPORTED_GAMES`, `getGameByKey`).
- No games seeded (catalogue untouched). No BGMI vocabulary in platform
  identity components. Unknown game keys fail closed at the reader
  (pass-through → zero rows) and in role checks (`validateTeamRoleForGame`
  returns false for unknown games). No multi-game teams (schema + form are
  single-`gameKey`).

## 2. Reversible implementation decisions

1. **Mirrored the `/players` vertical** (query lib, reader, results,
   pagination, skeleton, static audit) instead of inventing a new pattern.
   Rationale: same security posture, same reviewability; reversible at low
   cost.
2. **`member_count` accepts number or decimal string**, normalized to a
   safe integer. Rationale: PostgREST bigint serialization differs by
   client/version; strict-but-tolerant avoids a whole-directory outage.
   Anything else fails the row closed.
3. **No recruiting/role URL filter** although discovery "supports"
   recruiting status. Rationale: display-only satisfies the requirement;
   a client-side filter would corrupt pagination honesty, and extending
   the RPC needs migration acceptance.
4. **Initial-letter avatar, no logo upload.** Rationale: D1 has no logo
   column or storage bucket; any upload UX now would imply an unapproved
   schema/storage decision.
5. **Recruitment components are prop-fed presentational units** with no
   feed wiring. Rationale: open posts have no public RPC (member-gated
   base reads only); wiring a feed would require base-table reads that
   violate the RPC-only boundary.
6. **Header/footer gained "Discover teams" links; homepage roadmap and
   footer availability copy left unchanged.** Rationale: nav is additive
   and truthful (the routes exist); rewording shipped-vs-planned marketing
   claims belongs to a marketing pass after migration acceptance, recorded
   as a follow-up in `06-blockers-next-phase.md`.

## 3. Design direction compliance

- Dark immersive detail surfaces reuse the existing slate/white product
  surfaces from `/players` (no new palette, no neon, single controlled
  usage of existing tokens).
- Condensed uppercase display class (`font-display`) used for brand only,
  as in the existing header; directory headings match `/players` hierarchy.
- Labelled controls, skip-link preserved via root layout, `role="status"` /
  `role="alert"` states, visible focus outlines, 44px targets on nav —
  same as the audited player routes. No unnecessary animation.
- No stock imagery, no testimonials, no statistics, no sponsor claims.
