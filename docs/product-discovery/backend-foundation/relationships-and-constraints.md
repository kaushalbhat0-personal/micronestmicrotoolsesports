# Relationships & Constraints **[Proposed]**

## FK discipline (copied from live convention)

- Tenant/entity children → parents `ON DELETE CASCADE` (memberships, applications, links, submissions, reports stay with their entity while it lives).
- `created_by` / `captain_user_id` → profiles `RESTRICT` (cannot delete a user with live responsibilities — forces transfer first).
- Audit/moderation actor refs → profiles `SET NULL` or `CASCADE` per live pattern (`decided_by`/`reviewer` SET NULL preserves the record; reporter CASCADE matches legacy reports).
- Polymorphic targets (`reports.target_id`, `tournament_links` entity refs) carry **no FK** with mandatory `target_type`; app-layer existence checks + moderation queue integrity.

## Uniqueness

- Slugs/handles: `slug`/`handle` UNIQUE + format CHECKs (lowercase-hyphen / gamer-handle regex, trigger-lowercased).
- One-active-application partial uniques (player- and team-scoped) — the proven anti-double-apply guard.
- `(user_id, game)` and `(game, game_user_id)` on game profiles; `(brand, user)` on representatives; `(team)` on organization_teams (single owner); `(org, user)` on memberships (existing).

## State guards (trigger-enforced, mirroring live tool guards)

- Verified writes: `verified_at`/method/evidence only via reviewer path (client-capped CHECK + trigger reject).
- Opportunity transitions follow the status DAG; edits after applications write an audit note row; expiry only via sweep function or enforce-on-read (D-19).
- Reports/submissions: no owner UPDATE/DELETE (service-role triage only).
- Last-owner/last-admin protection extended to teams/brands (adaptation of `enforce_organization_owner_count` pattern).
- Brand opportunity public visibility requires `brands.verification_state=verified` AND representative verified AND `moderation_state=approved` (triple gate, enforced in views + policies).

## Deletion rules

- Users: blocked while owning/admin-captaining live entities (RESTRICT) → transfer-then-delete flow.
- Entities: soft-delete (`archived_at`) preserving applications/audit; hard delete only for never-published drafts via owner path.
- No CASCADE from users into entity-owned data (prevents accidental org wipes on account deletion).
