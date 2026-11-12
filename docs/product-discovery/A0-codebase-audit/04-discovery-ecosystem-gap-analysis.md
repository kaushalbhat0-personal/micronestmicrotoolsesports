# 04 — Discovery Ecosystem Gap Analysis

**Vision:** Players ↔ Teams ↔ Organizations ↔ Brands; Teams independent or org-owned. **Approved baseline:** G1 identity/player-profile (`docs/architecture/g1-identity-player-profile/11-decision-freeze.md`, `docs/product-discovery/domain-model.md`).

## 1. What exists

| Entity | Status | Evidence |
|---|---|---|
| Players (canonical + BGMI game profiles) | Working | `src/features/player-profile/`, `player_profiles` + `player_game_profiles`, `/players`, `/players/[handle]`, `/settings/profile` |
| Player discovery (consent-first, masked, RPC-only) | Working | `search_player_directory()` + `get_player_by_handle()`, frozen 12-col projection, `is_discoverable AND is_visible AND active` predicate, 404-equivalence, `noindex` posture |
| Avatar | Working | `public-avatars` bucket + `server/avatar.ts` |
| Handle lifecycle + deletion | Working | `update_player_handle()` + cooldown, owner DELETE |
| Verified-email gate | Working | D-G1-10: verified email required before public discoverability |
| Teams | Absent | No `src/features/teams`, no routes, no tables. Future `team_members(user_id) FK → app_users(id)` noted only in `player-profile/README.md:93` |
| Organizations / divisions | Absent | No dirs/routes/tables. Legacy `organizations` pattern exists only in archive |
| Brands / representatives | Absent | No dirs/routes/tables |
| Relationships (membership, ownership, representation, follows) | Absent | No FKs beyond `player_profiles.user_id → app_users.id` |
| Multi-role support | Absent | Only facet `primary_role` (BGMI allowlist) + `app_users.status=active|suspended`. No captain/owner/admin/recruiter roles |
| Public visibility / privacy | Working for players | Master `is_discoverable DEFAULT false` + per-game `is_visible`; revocation immediate in queries; external de-index best-effort |
| Verification | Explicitly forbidden in G1 | `player-profile/README.md:52`; `private-verification` bucket exists with zero wiring; player-discovery copy disclaims rankings/verification |

## 2. Comparison vs G1 architecture

G1 intent (single identity → canonical profile → per-title game profiles → consent-gated masked projection) is faithfully implemented. No deviation found: session-derived identity only, no user-ID args, no service-role in `src/`, no owner UPDATE on `app_users`, middleware never bootstraps.

## 3. Missing domain models / dependencies

1. `teams`, `team_members`, `organization`, `organization_members/divisions`, `brands`, `brand_representatives` tables + FKs to `app_users(id)` — none exist.
2. Role/capability model (captain writes, owner/admin/recruiter, editor for tournaments/news) — none exists beyond `status`.
3. Recruitment/opportunity/application models (tryouts, roles, interest queue) — spec-only (Phases 2–4).
4. Verification pipeline (submissions, review queue, badges) — forbidden in G1; bucket reserved.
5. Moderation/reporting (`reports.target_id` polymorphic) — spec-only (`relationships-and-constraints.md:8`).
6. Cross-entity search (shared search over players/teams/orgs/brands) — players-only.
7. Notifications, audit history, rate limiting — absent in greenfield (patterns only in archive).

## 4. Constraints

Do not invent relationships. Future FKs must target `app_users(id)` (per `player-profile/README.md:91-94`); future vacancies/opportunities must reference `games(key)`. Do not migrate legacy `finder_*` tables (hardcoded `bgmi`, flat squad, free-text regions, zero live rows per `live-schema-inventory.md:26`; deprecated by D-11).
