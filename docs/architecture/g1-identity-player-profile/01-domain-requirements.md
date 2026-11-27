# 01 — Product and Domain Requirements (G1: Identity & Player Profile)

Scope: authentication identity, application user identity, canonical player profile, game catalogue relationship, player game profiles, discoverability/consent, privacy projections, account/profile lifecycle, authorization/RLS. No Team, Organization, Brand, Vacancy, Opportunity, Application domains (integration contracts only).

## 1. Personas and use cases

### P1 — Player (primary)
- Creates one account, completes one canonical player profile.
- Adds one or more game profiles; BGMI first.
- Controls discoverability per-profile and per-game.
- Goal: be discoverable by players/teams/orgs/brands without stranger DMs; apply via published vacancies/opportunities (later phases).

Use cases:
- Sign up, verify email (per baseline), create handle/display name/avatar/bio/region.
- Create/edit/delete own BGMI game profile (IGN, identifier, role, mode, region/server, availability, visibility).
- Opt in/out of public discoverability; hide individual game profiles; revoke consent.
- Delete player profile while keeping account (e.g., stepping away) or delete account entirely.
- Upload/replace/delete avatar within quota.

### P2 — Team captain / recruiter (consumer, not built in G1)
- Searches public player directory by game/role/region/availability.
- Views masked public projection only. No PII. No DMs.
- Future: publishes vacancies; reviews applications (later phases).

### P3 — Organization owner/admin/recruiter (consumer, not built in G1)
- Same discovery as P2, plus future division management and vacancy publishing.
- Requires verified org relationship (future domain, not G1).

### P4 — Brand representative (consumer, not built in G1)
- Discovers players/teams/orgs via public projections for opportunities.
- Requires verified brand relationship (future domain, not G1).

### P0 — Moderator / platform admin (future)
- Reviews verification evidence and reports. Needs private evidence access via signed URLs, never public URLs. Full moderation workflow (D-08) is out of scope; G1 must not block it (evidence stays private, reviewer path reserved).

## 2. Functional requirements

### Identity (FR-ID)
- FR-ID-01: One `auth.users` row maps to at most one application user row (`user_id = auth.uid()`). APPROVED D-G1-01: application identity is initialized lazily on first authenticated app action. No `on_auth_user_created` trigger; no `auth`-schema trigger is an active option (see 02).
- FR-ID-02: One user holds at most one canonical player profile.
- FR-ID-03: One player profile holds many game profiles; uniqueness `(player, game)` enforced; BGMI is seeded catalogue entry, schema supports additional titles without altering canonical profile.
- FR-ID-04: No separate auth accounts for player/team/org/brand. Future entity memberships reference the single application user.
- FR-ID-05: Account deletion removes application user + player profile + game profiles (cascade) and orphans/cleans avatars; auth user deletion follows via admin flow (see 02 lifecycle).
- FR-ID-06: Player profile deletion without account deletion is supported (profile row removed, game profiles cascade, account remains for future entity relationships).

### Player profile (FR-PL)
- FR-PL-01: Canonical fields: handle (unique, constrained), display name, avatar reference, bio (short), country/region (catalogued, not free text), discoverability consent flag, completion state (derived), timestamps.
- FR-PL-02: Handle rules: lowercase `a-z0-9_` (3–20), unique case-insensitively. Justification for reuse: legacy `finder_profiles.handle` pattern is proven against squatting/confusion; retained with explicit justification, not blind copy.
- FR-PL-03: Display name 1–40 chars; bio ≤280 chars, optional; avatar optional.
- FR-PL-04: Completion state is derived in application code (required fields present + ≥1 visible game profile optional), never stored as trust signal.
- FR-PL-05: No skill score, rank, K/D, device, sensitivity fields. Competitive history only if verifiable structure exists (title/placement/event, no free-form claims); G1 stores none beyond availability/role.

### Game profiles (FR-GM)
- FR-GM-01: Game catalogue table (`games`: `key`, `name`, `short_name`, `is_active`) seeded with `bgmi`; adding titles is data + validation, not schema change.
- FR-GM-02: BGMI game profile fields: IGN (2–30), game user identifier (text, preserves leading zeroes, optional), preferred role (catalogued enum, not free text), play mode (catalogued), region/server (catalogued), availability windows (catalogued set), visibility flag, timestamps.
- FR-GM-03: BGMI roles initial set: `IGL | Assaulter | Support | Scout` (legacy `domain/roles.ts` set reused with justification: matches BGMI team structure; extensible per-game role catalogue, not global enum).
- FR-GM-04: Self-declared vs verified: all G1 game fields are self-declared; `verification_status` is reserved for a later verification domain (no fake `verified` badge in G1). Evidence bucket exists but G1 performs no verification workflow.
- FR-GM-05: No universal skill score. No rank/K-D storage.

### Discoverability/consent (FR-PV)
- FR-PV-01: Private by default. No public exposure without explicit opt-in.
- FR-PV-02: Two-level consent: canonical `is_discoverable` AND per-game-profile `is_visible`. Public projection requires both.
- FR-PV-03: Revocation is immediate in query results (projection filters on flags); documented propagation delay for caches/indexes (see 04).
- FR-PV-04: Authenticated users get no extra PII beyond public projection unless they own the row. No “logged-in sees more” without ownership.
- FR-PV-05: Public reads served via APPROVED RPC-only projections (`search_player_directory`, `get_player_by_handle` returning only allowlisted columns), never base-table SELECT. No broad public views (D-G1-03).

### Lifecycle (FR-LC)
- FR-LC-01: Signup → application user lazily initialized → player profile created explicitly by user action (not auto-drafted with placeholder handle).
- FR-LC-02: Suspension: flag on application user (future admin), blocks writes and hides from discovery without deleting data.
- FR-LC-03: Deletion cascades defined in 05 (player → game profiles; avatar objects cleaned via app + storage policy).

## 3. Non-functional requirements

- NFR-01 Security: RLS on every user-owned table; deny-by-default; anon sees only projection; least-privilege grants; no `SECURITY DEFINER` unless justified with fixed `search_path` + ownership audit (see 05).
- NFR-02 Privacy: data minimization; masked projection; no PII in logs/URLs; avatar paths `{uid}/...` never leak other users’ UIDs.
- NFR-03 Performance: discovery queries indexed on `(game, region, role, availability)`-style predicates; public projection avoids N+1; avatar CDN via public bucket.
- NFR-04 Maintainability: feature-driven `src/features/player-profile/` (future), Zod at every boundary, strict TS, repository pattern isolating Supabase client.
- NFR-05 Accessibility/SEO: mobile-first, WCAG AA, SEO-aware public routes with `noindex` default unless discoverable + `allow_indexing` equivalent (see 04); masked handle-based URLs (`/players/[handle]`), never numeric IDs or UIDs in public URLs.
- NFR-06 Reliability: idempotent migrations (see G0.2 pattern), explicit constraints (not app-only), `handle_updated_at` trigger reuse.

## 4. Domain boundaries

In scope (G1):
- `auth.users` ↔ application user linkage, lifecycle, suspension/deletion semantics.
- Canonical player profile + handle uniqueness + completion.
- Game catalogue + player game profiles (BGMI initial).
- Consent flags + public projection contract.
- Avatar storage usage within existing buckets.

Out of scope (future contracts only):
- Teams (independent vs org-owned), team membership/roles, vacancies.
- Organizations (owner/admin/recruiter), divisions, brand representatives/verification.
- Opportunities, applications, application caps/notes (D-09 open).
- News, tournaments, mini-games.
- Moderation SLA/strikes (D-08 open), reports workflow, verification review.
- Payments, escrow, feed, comments, DMs, CRM, microservices.

Integration contracts G1 must not break (see 07):
- Future `team_members(user_id)`, `organization_members(user_id)`, `brand_representatives(user_id)` FK to application user (UUID, not auth directly).
- Future `vacancies`/`opportunities` reference game catalogue keys.
- Future verification domain may add `verification_status` to game profiles; G1 reserves the column name but does not implement workflow.

## 5. Explicit exclusions

- No stranger DMs. No contact details on public projections.
- No discovery paywall. Search is free; no gating.
- No fabricated scores, tiers-as-skill, or unverified badges.
- No JSONB core entity modeling; relational tables with constraints.
- No generic `metadata`/`attributes` tables for player/game entities.
- No event-driven architecture for profile CRUD.
- No duplicate identities per entity type.

## 6. Assumptions and unresolved decisions

Assumptions (architectural, reversible):
- A1: APPROVED D-G1-01: lazy application-user creation on first authenticated action. No trigger in `auth` schema (see 02 for rationale; avoids trigger in `auth` schema and orphan rows from abandoned signups).
- A2: Handle-based public URLs (`/players/[handle]`) with case-insensitive uniqueness.
- A3: APPROVED D-G1-09: `country_code` is an optional ISO 3166-1 alpha-2 code; game server/region (`region_code`) is a game-specific controlled vocabulary selected per game. `ONLINE` is permitted only in an applicable game-region vocabulary, never as a `country_code`. Legacy free-form `region` caused wildcard matching hacks; G1 fixes with catalogues + CHECKs.
- A4: Availability as catalogued set (e.g., `weekday-evenings`, `weekend`) with array + GIN, capped length.

Unresolved (see `10-open-decisions.md`; D-08/D-09 remain open and are NOT decided here):
- U1: Email-confirmation enforcement for discoverability (baseline `enable_confirmations=false`; product decision before public onboarding).
- U2: Suspension UX/authority (who suspends, appeal) — schema reserves flag, workflow later.
- U3: `allow_indexing` semantics (per-profile SEO opt-in) — reserved, not enforced in G1 queries beyond projection.
- U4: BGMI identifier label/validation (numeric ID format varies by title; keep text + length cap, no format lock).
- U5: Completion-state definition exact required set (proposed in 03, needs product sign-off).
