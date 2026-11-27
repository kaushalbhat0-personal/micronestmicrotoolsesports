# 03 — Player Profile Domain Model

## 1. Canonical profile (`player_profiles`, proposed)

One row per user. PK `user_id uuid REFERENCES app_users(id) ON DELETE CASCADE`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `user_id` | uuid | NOT NULL | — | PK + FK. Equals `auth.uid()`. |
| `handle` | text | NOT NULL | — | Unique case-insensitively. `^[a-z0-9_]{3,20}$`, stored lowercase. Public (in projection). |
| `display_name` | text | NOT NULL | — | 1–40 chars. Public. |
| `avatar_path` | text | NULL | NULL | Storage object path in `public-avatars` (`{uid}/avatar.{ext}`), not full URL. Public URL derived. Private column? Path itself is safe (uid-scoped) but only exposed via projection as resolved public URL. |
| `bio` | text | NULL | NULL | ≤280 chars. Public only when discoverable. |
| `country_code` | char(2) | NULL | NULL | APPROVED D-G1-09: optional ISO-3166-1 alpha-2 code (CHECK against allowlist). Never `ONLINE`. Optional. Public when discoverable. |
| `is_discoverable` | boolean | NOT NULL | `false` | Explicit consent master switch. Private flag; effect is public (row appears or not). |
| `created_at` / `updated_at` | timestamptz | NOT NULL | `now()` | `updated_at` maintained by `handle_updated_at()` trigger (foundation reuse). Private. Omitted from public projections per APPROVED D-G1-03 (no precise timestamps, no year-exposed fallback). |
| `suspended_at` | — | — | — | NOT on this table; lives on `app_users` (see 02). |

Required vs optional: `handle` + `display_name` required; `bio`, `country_code`, `avatar_path` optional. `is_discoverable` required with safe default `false`.

Moderation-controlled: none in G1 (future: `is_banned`/appeal fields live on `app_users`, not here).

Validation (Zod boundaries, DB CHECKs mirror):
- `handle`: regex + lowercase transform + length; DB `CHECK (handle ~ '^[a-z0-9_]{3,20}$')` + unique index `UNIQUE (lower(handle))`.
- `display_name`: trimmed 1–40, no URL/HTML (strip tags server-side; DB length CHECK).
- `bio`: trimmed ≤280, no links for discoverable profiles (app rule; DB length CHECK only — link policy enforced at validation + moderation, not CHECK regex, to avoid brittle DB regex).
- `country_code`: optional ISO-3166-1 alpha-2 allowlist (APPROVED D-G1-09); app validates against seeded country list; game-specific validation must not be hardcoded into canonical identity.

## 2. Game catalogue (`games`, proposed)

| Column | Type | Notes |
|---|---|---|
| `key` | text PK | e.g. `bgmi`. Stable, URL-safe. |
| `name` | text NOT NULL | e.g. `BGMI`. |
| `short_name` | text NOT NULL | e.g. `BGMI`. |
| `is_active` | boolean NOT NULL DEFAULT `true` | Inactive titles hidden from creation but existing profiles remain. |
| `created_at` | timestamptz NOT NULL DEFAULT `now()` | |

Seed: `('bgmi','Battlegrounds Mobile India','BGMI',true)`. Adding titles = `INSERT`, no schema change. RLS: public read (anon + authenticated SELECT); writes service-role only (admin seeding).

## 3. Player game profile (`player_game_profiles`, proposed)

One row per `(player, game)`. PK `id uuid DEFAULT gen_random_uuid()`; `UNIQUE (player_user_id, game_key)`.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK (pgcrypto). Never in public URLs. |
| `player_user_id` | uuid | NOT NULL | — | FK `player_profiles(user_id) ON DELETE CASCADE`. |
| `game_key` | text | NOT NULL | — | FK `games(key) ON DELETE RESTRICT`. |
| `ign` | text | NOT NULL | — | In-game name, trimmed 2–30. Public when visible. |
| `game_user_id` | text | NULL | NULL | Title identifier (preserves leading zeroes as text), ≤32. Optional. Owner-visible only; omitted from public projections per APPROVED D-G1-03. Masked last-4 remains OPEN under D-G1-04 (not decided here). |
| `primary_role` | text | NULL | NULL | Catalogued per-game role (BGMI: `IGL|Assaulter|Support|Scout`). NULL = flexible. |
| `play_modes` | text[] | NOT NULL | `'{}'` | Catalogued set (e.g., `squad|duo|solo|tpp|fpp`), max 5. GIN-indexed. |
| `region_code` | text | NULL | NULL | APPROVED D-G1-09: game-specific controlled vocabulary (e.g., BGMI: `asia|india|europe|north-america|online`). Selected according to the player's game; different games may define different vocabularies. `ONLINE` permitted only where the applicable game vocabulary allows it. Optional. |
| `availability` | text[] | NOT NULL | `'{}'` | Catalogued windows (e.g., `weekday-evenings|weekend|flexible`), max 7. GIN-indexed. |
| `is_visible` | boolean | NOT NULL | `true` | Per-game visibility; game-level effective visibility = `player.is_discoverable AND game.is_visible` (full public-row predicate additionally requires `app_users.status='active' AND games.is_active` — see 04 §2 / 05 §5). |
| `created_at` / `updated_at` | timestamptz | NOT NULL | `now()` | Trigger on `updated_at`. |

Constraints:
- `UNIQUE (player_user_id, game_key)`.
- `CHECK (ign <> '')`, length checks.
- `CHECK (array_length(play_modes,1) IS NULL OR array_length(play_modes,1) <= 5)`, same for `availability <= 7`.
- Per-game role/mode/region validated against allowlists in Zod + CHECK `= ANY (...)` (small static lists; adding values = migration, acceptable for controlled vocabularies).

## 4. Relationships and cardinality

```mermaid
erDiagram
  AUTH_USERS ||--|| APP_USERS : "id = auth.uid()"
  APP_USERS ||--|| PLAYER_PROFILES : "user_id 1:1"
  PLAYER_PROFILES ||--|{ PLAYER_GAME_PROFILES : "player 1:N"
  GAMES ||--|{ PLAYER_GAME_PROFILES : "catalogue 1:N"
  APP_USERS ||--|{ TEAM_MEMBERS : "future 1:N"
  APP_USERS ||--|{ ORGANIZATION_MEMBERS : "future 1:N"
  APP_USERS ||--|{ BRAND_REPRESENTATIVES : "future 1:N"

  AUTH_USERS {
    uuid id PK
  }
  APP_USERS {
    uuid id PK_FK
    text status
  }
  PLAYER_PROFILES {
    uuid user_id PK_FK
    text handle
    text display_name
    text avatar_path
    text bio
    char country_code
    boolean is_discoverable
  }
  GAMES {
    text key PK
    text name
    boolean is_active
  }
  PLAYER_GAME_PROFILES {
    uuid id PK
    uuid player_user_id FK
    text game_key FK
    text ign
    text game_user_id
    text primary_role
    textarray play_modes
    text region_code
    textarray availability
    boolean is_visible
  }
```

## 5. BGMI initial field model

- `ign`: required, 2–30. Self-declared.
- `game_user_id`: optional text ≤32 (numeric-looking IDs kept as text). Self-declared; never treated as proof of account control.
- `primary_role`: optional, one of `IGL|Assaulter|Support|Scout`. Self-declared preference, not verified skill.
- `play_modes`: optional set, catalogued.
- `region_code`: optional game-specific vocabulary for BGMI (catalogued server/region).
- `availability`: optional catalogued windows.
- Explicitly absent: rank/tier, K/D, kills, damage, device, sensitivity, clan history, earnings. Rationale: unverifiable from G1 inputs; storing them invites fake claims and the forbidden skill score.

## 6. Self-declared versus verified attributes

| Attribute | G1 status | Future |
|---|---|---|
| handle/display/bio/avatar/region | Self-declared, user-editable | Moderation takedown only (D-08) |
| ign/role/modes/availability | Self-declared | Unchanged |
| `game_user_id` | Self-declared text | Verification domain may bind to evidence/API; G1 must not label it verified |
| Verification badge/status | NOT IMPLEMENTED | Reserved column name `verification_status` Do NOT add in G1; UI shows no badge |

Rule: anything the platform has not independently checked is rendered without trust chrome. No “verified” string, checkmark, or score in G1.

## 7. Lifecycle and validation rules

- Creation: `app_users` ensured → `player_profiles` insert (handle unique) → optional first `player_game_profiles` insert. All server-side, Zod-validated, transactional where multi-row.
- Updates: owner-only; `handle` change allowed but rate-limited in app (e.g., max 1 per 30 days — app rule, open decision D-G1-05) to prevent squatting churn; `updated_at` via trigger.
- Game profile add/remove: owner-only; at least zero game profiles allowed (canonical profile can exist undiscoverable with no games).
- Deletion: profile delete cascades game profiles; avatar cleanup app-driven (see 06).
- Validation layering: Zod (boundary, friendly errors) → DB CHECK/UNIQUE/FK (guarantee). Never rely on client checks. Mass-assignment guarded by explicit allowlists in server actions (see 07).
