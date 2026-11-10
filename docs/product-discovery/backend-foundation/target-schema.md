# Target Schema **[Proposed]**

Conventions: `id uuid PK DEFAULT gen_random_uuid()` unless noted; `created_at/updated_at timestamptz` with updated-at trigger; TEXT value sets via CHECK (no native enums, matching live convention); soft-delete via `archived_at` where history matters. Nothing here is created yet.

## Identity (reuse live)

`profiles`, `organizations` (+timezone/logo), `organization_members` with role widened to `owner|admin|recruiter|member` **[Approved mechanism D-02; values frozen here as proposal]**, `organization_audit_logs`, `platform_admins`, `admin_audit_logs`. No structural change except the role CHECK + recruiter helper (adaptation migration).

## Game system (new, D-01)

- `game_titles(slug PK, name, roles text[] NOT NULL DEFAULT {}, id_format_hint, id_format_regex, is_active DEFAULT true)` — seed: BGMI (`roles {IGL,Assaulter,Support,Scout}`). No title hardcoded anywhere else.
- `player_profiles(user_id PK→profiles CASCADE, handle UNIQUE lowercased by trigger, display_name, avatar_url, region, languages text[] DEFAULT {}, timezone, current_level/target_level self-reported CHECK set, looking_for DEFAULT true, open_to_tryout, bio ≤280, allow_indexing DEFAULT false, is_searchable GENERATED AS (looking_for) STORED, archived_at)`.
- `game_profiles(id, user_id→profiles CASCADE, game→game_titles CASCADE, ign, game_user_id TEXT (leading zeros preserved), verification_status DEFAULT unverified, verification_method, verified_at, evidence_id UUID no-FK, UNIQUE(user_id,game), UNIQUE(game,game_user_id), CHECK verified→verified_at NOT NULL; client writes capped to unverified|pending with method/verified_at NULL)`.

## Teams (new)

- `teams(id, slug UNIQUE, name, game→game_titles, region, description ≤1000, current/target_level, captain_user_id→profiles RESTRICT, owning_org→organizations SET NULL NULL=independence, recruiting DEFAULT true, contact_mode application_only|external_link, external_link https CHECK PRIVATE, is_public DEFAULT true, archived_at, created_by→profiles RESTRICT)`.
- `team_memberships(team_id→teams CASCADE, user_id→profiles CASCADE, role captain|co-captain|player|sub, game_role, joined_at, PK(team_id,user_id))`.
- `organization_teams(org→organizations CASCADE, team→teams CASCADE, division_label, since, PK(org,team), UNIQUE(team) — one owning org at a time)`.

## Brands (new)

- `brands(id, slug UNIQUE, name, category, description, logo_url, website https, verification_state unverified|pending|verified|rejected DEFAULT unverified, archived_at)`.
- `brand_representatives(id, brand→brands CASCADE, user_id→profiles CASCADE, scope admin|recruiter, verification_state + evidence_ref PRIVATE, verified_by/at, UNIQUE(brand,user_id))`.

## Opportunities (new shared engine)

- `opportunities(id, publisher_type team|organization|brand, publisher_team→teams SET NULL, publisher_org→organizations SET NULL, publisher_brand→brands SET NULL, CHECK exactly-one-publisher, target_type player|team|staff|partner, opportunity_type player_recruitment|team_recruitment|staff|partnership|sponsorship|other, game→game_titles NULL allowed for non-game roles, role_needed, slots ≥1, level window, region, requirements, compensation_framing REQUIRED CHECK (range|fixed|revenue_share|unpaid_trial|other_explicit — never empty), application_method in_platform|external_link, external_link https PRIVATE, status draft|open|paused|closed|filled|expired DEFAULT draft, expires_at, moderation_state unreviewed|approved|flagged|removed DEFAULT unreviewed, published_at, archived_at, created_by; partial index WHERE status=open AND moderation_state=approved for discovery)`.
- Status: `draft → open ⇄ paused → closed|filled|expired`; expiry sweep transitions to `expired`. First-listing review gate: publisher's first opportunity requires `approved` before public visibility.

## Applications (new, one lifecycle)

- `applications(id, opportunity→opportunities CASCADE, applicant_type player|team|staff_applicant|partner, applicant_user→profiles CASCADE, applicant_team→teams SET NULL (captain-applied), note ≤200 (cap per D-09 numbers later), status applied|shortlisted|accepted|declined|withdrawn DEFAULT applied, decided_by→profiles SET NULL, decided_at, CHECK applied|withdrawn→decided_at NULL, partial UNIQUE(opportunity, applicant_user) WHERE status IN (applied, shortlisted), plus team-scoped equivalent guard)`.

## Trust (new, reuse patterns)

- `verification_submissions(id, subject_type player_game|brand_rep|organization, subject refs, evidence_path PRIVATE (storage), status pending|approved|rejected|needs_review DEFAULT pending, reviewer→profiles SET NULL, reviewed_at, CHECK pending→reviewer/reviewed_at NULL; no owner UPDATE)`.
- `reports(id, reporter→profiles CASCADE, target_type player|team|organization|brand|opportunity|application, target_id UUID no-FK polymorphic, reason 10–1000, category impersonation|fake_listing|misleading_sponsorship|spam|abuse|other, status open|reviewing|resolved|dismissed DEFAULT open, strike_applied DEFAULT false; no owner UPDATE/DELETE)`.
- `moderation_strikes(id, publisher_user→profiles CASCADE, publisher_entity refs, reason, action warning|takedown|publishing_ban, created_at)` — counters feed D-08 numbers when set.

## Secondary (new)

- `news_articles(id, slug UNIQUE, title, category, game→game_titles NULL, body, sources jsonb (attribution links), status draft|published|archived DEFAULT draft, author→profiles SET NULL, published_at)`.
- `tournaments(id, slug UNIQUE, name, game→game_titles, organizer, starts_on/ends_on, format, entry_requirements, registration_url https, registration_note, status upcoming|ongoing|completed DEFAULT upcoming, published DEFAULT false)`.
- `tournament_links(id, tournament→tournaments CASCADE, entity_type player|team|organization, entity refs, evidence_url, self_reported DEFAULT true)` — loose competitive-evidence anchor, deferred population.
- `notification_queue(id, user→profiles CASCADE, kind application_status|shortlist|verification|moderation|publish, title, body_ref refs, read_at, created_at; index WHERE read_at IS NULL)`.
