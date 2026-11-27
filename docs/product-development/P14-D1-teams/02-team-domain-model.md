# 02 — Team Domain Model (P14-D1)

**Status:** proposed contract for implementation after open decisions in `10-open-product-decisions.md`.  
**Principle:** BGMI-first, multi-title-ready without overengineering. Preserve G1 identity (`app_users`) separate from game identity (`player_game_profiles`).

---

## 1. Entity overview

```
app_users (G1)
    │
    ├── owns ──► teams (1 owner_user_id)
    └── member of ──► team_members (N teams / user — pending D1-D1 confirmation)
                          │
teams ── game_key ──► games (G1 catalogue)
```

**Not in foundation v1 as separate entities:** `team_games`, invitations, applications, recruitment posts (see §5), logos as first-class media tables.

---

## 2. Team aggregate

| Field | Type (logical) | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `slug` | text | Unique, immutable after create; lowercase hyphenated 2–60 |
| `name` | text | 2–60 |
| `description` | text nullable | ≤1000 |
| `logo_path` | text nullable | **Open** — storage path only if media approved; omit until decided |
| `banner_path` | text nullable | **Open** — default omit for v1 |
| `country_code` | text nullable | **Open** — omit unless product requires; region already exists |
| `region_code` | enum (BGMI vocab) | Closed set aligned to G1 |
| `game_key` | FK → `games.key` | **One primary/supporting game per team** (recommended) |
| `current_level` | competitive level | Self-reported only |
| `target_level` | competitive level | Self-reported only |
| `recruiting` | boolean | Team-level recruiting flag |
| `is_public` | boolean | Discovery gate |
| `lifecycle_status` | enum | Recommended: `active` \| `archived` (default `active`) |
| `owner_user_id` | FK → `app_users` | Session-derived at create; transfer only via RPC |
| `created_by` | FK → `app_users` | Immutable audit of creator |
| `organization_id` | text nullable | **Inert** — never authority |
| `created_at` / `updated_at` | timestamptz | Trigger-maintained |

### Levels (closed)

`casual | community | competitive | higher-tier | semi-pro | professional`  
Display as **self-reported**, never as verified ranking.

### What is deliberately omitted from v1

- Tournament achievements, rankings, verified badges, fabricated member stats.
- Age restrictions (no explicit legal product requirement found).
- Free-text contact channels as identity (WhatsApp workflows stay out of domain).

---

## 3. Game support — decision recommendation

| Option | Recommendation |
| --- | --- |
| One primary game on `teams.game_key` | **Adopt for BGMI release** |
| `team_games` multi-row | **Defer** — multi-title org = multiple team rows |
| Game-specific team details | Encode via CHECK/Zod per `game_key` until a second title ships |
| Roster membership | **Global to the team** (not per-game) while one game/team holds |

**Rationale:** roles/regions/levels are per-game vocabularies. A multi-game team is a redesign (divisions, per-game recruitment), not a flag. Multi-title readiness = catalogue + validation extension path, not premature junction tables.

---

## 4. Membership model

### Separate status from role (required correction vs current D1 SQL)

Current D1 `team_members` stores only `role`. Product needs invitations, applications, removals, and departures without overloading role.

**Recommended columns on `team_members`:**

| Column | Values |
| --- | --- |
| `role` | `owner_roster` **or keep owner off roster** + `captain` \| `co_captain` \| `player` \| `sub` |
| `membership_status` | `active` \| `invited` \| `applied` \| `removed` \| `left` \| `suspended` |
| `game_role` | nullable BGMI role (`IGL`…) for active competitive context |
| `joined_at` / `left_at` | timestamps |

**Recommended authority model (pending D1-D3):**

- **Owner** is `teams.owner_user_id` (may exist without roster row).
- **Captain** is an active member with `role = captain`.
- **Co-captain** has **no** elevated rights until a subset is approved.
- **Member** = any other active membership.
- Do **not** introduce `manager` unless product explicitly requires it (default: omit).

### Pending invitation / application

Treat as **workflows**, not automatic tables for foundation:

| Workflow | Foundation v1 | Later (P3+) |
| --- | --- | --- |
| Create team + owner | Yes | — |
| Owner/captain edit team profile | Yes (after auth matrix) | — |
| Direct membership insert from client | **Never** | — |
| Invite / accept | No | Dedicated RPC + optional `team_invitations` |
| Apply to join | No | Recruitment posts + applications after D1-D12 |
| Remove / leave | Design-ready, RPC later | With last-owner protection |

### Lifecycle events (membership)

```
(none) → active          [create-team seeds owner authority; optional captain roster row]
active → left            [voluntary leave RPC]
active → removed         [owner/captain remove RPC]
active → suspended       [platform moderation — service path]
invited → active|declined
applied → active|declined|withdrawn
```

Only transitions that are owner-approved get RPCs. Unapproved transitions stay impossible.

---

## 5. Recruitment (evaluate, do not auto-build)

| Concern | Foundation recommendation |
| --- | --- |
| Recruiting enabled/disabled | Keep `teams.recruiting` boolean for directory display |
| Positions / roles recruiting | Defer `recruitment_posts` write path to P3 |
| Game-specific requirements | Inherit team `game_key`; post must match team game when built |
| Age restrictions | Omit |
| Contact / apply mechanism | Defer until privacy contract approved |
| Closure | Defer guarded post states (`open/paused/closed/filled`) |

Foundation may **omit** creating `recruitment_posts` / `applications` tables until D1-D12, **or** create them RLS-locked with zero write RPCs. Prefer **omit from first P14 migrations** to keep the smallest coherent set (see `06-database-schema-proposal.md`).

---

## 6. Public vs private field classes

| Public (discovery) | Private / member-only | Never public |
| --- | --- | --- |
| slug, name, description | roster identities (if approved) | owner_user_id, created_by |
| game_key, region_code | membership_status details | organization_id |
| levels, recruiting, member_count | recruitment notes | application notes, decided_by |
| is_public gate (predicate only) | audit events | reporter identities, moderation internals |

---

## 7. Pure domain functions to preserve

- `COMPETITIVE_LEVELS`, `meetsLevelMinimum`, `SELF_REPORTED_LEVEL_NOTE`
- `SUPPORTED_GAMES` / `BGMI_ROLES` / `isRoleForGame`
- Frozen `TEAM_DIRECTORY_COLUMNS` key-set discipline
- Workspace role resolution (`owner` / `captain` / `member`)
- Strict Zod create/update schemas rejecting smuggled ownership keys

---

## 8. Invariants (domain)

1. One team ↔ one `game_key` at creation; immutable thereafter.
2. Slug unique and immutable.
3. Owner identity only from session at create; never from client body.
4. Membership mutations only through authorized RPCs after approval.
5. At least one owner at all times; last-owner leave/delete denied.
6. Suspended `app_users` cannot mutate teams.
7. Public projection never widens without an explicit contract change + tests.
8. No cross-feature import of legacy finder runtime.
