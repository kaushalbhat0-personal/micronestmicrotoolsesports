# 04 — Privacy and Consent Model

## 1. Default privacy behavior

- Private by default. `player_profiles.is_discoverable DEFAULT false`; `player_game_profiles.is_visible DEFAULT true` but ineffective until master consent is true (effective = AND).
- New profiles are invisible in every public surface (directory, search, direct URL) until the owner explicitly enables discoverability.
- Authenticated ≠ authorized: logged-in users see only their own private rows plus the same public projection as visitors for others.

## 2. Discoverability consent

Two toggles, one effective rule:

- Master: `player_profiles.is_discoverable` (explicit opt-in checkbox, separate from profile creation; requires confirmation when enabling).
- Per-game: `player_game_profiles.is_visible` (per-title toggle; e.g., show BGMI but hide a future title).
- Effective public row condition (APPROVED D-G1-03): `player.is_discoverable = true AND game.is_visible = true AND app_users.status = 'active' AND games.is_active = true` (the `games.is_active` conjunct applies to game-joined rows; canonical-only reads use the first three).

Transitions:
- Enable master → profile becomes eligible; only `is_visible` games appear.
- Disable master → immediate disappearance from projection queries (see §4 propagation).
- Toggle per-game → that title appears/disappears without affecting others.
- All toggles are owner-only writes (RLS WITH CHECK binds `auth.uid()`).

Consent copy requirement: enabling must state exactly what becomes public (handle, display name, avatar, bio, country, game IGN/role/modes/region/availability per §3). No dark patterns; separate “save profile” from “make discoverable.”

## 3. Visibility states

| State | `is_discoverable` | `is_visible` (game) | Visible in directory? | Direct URL? |
|---|---|---|---|---|
| Private (default) | false | * | No | 404 (indistinguishable from nonexistent — no enumeration) |
| Master on, game hidden | true | false | No (that game) | 404 for that game section; canonical may show other games |
| Discoverable | true | true | Yes (projection row) | 200 with projection only |
| Suspended | * | * | No (all) | 404 |

Direct-URL rule: non-eligible profiles return the same 404 as nonexistent handles. Never redirect to login (leaks existence) or render “private profile” shell (leaks existence + handle validity).

## 4. Revocation behavior

- Database effect: immediate. Projection predicates include consent flags, so the next query excludes the row. No background job needed for correctness.
- Cache/index propagation: public pages use short-lived caching with `no-store` or seconds-scale revalidation for profile routes; search indexes (if any future) must filter on read or accept documented delay. Requirement: revocation effective in app queries instantly; external search-engine de-indexing relies on `noindex` + removal and is best-effort (disclosed in UI copy).
- `allow_indexing` (SEO opt-in, reserved): even discoverable profiles default to `noindex` unless the owner also opts into indexing. G1 projection includes the flag; route layer maps to robots meta. (Legacy had `allow_indexing` stored but unenforced — G1 fixes by enforcing in the route layer.)

## 5. Public versus private fields

Public projection allowlist — FROZEN per APPROVED D-G1-03 (only these ever leave the server for others; fixed order for RPC `TABLE(...)` definition):
- `handle`, `display_name`, avatar public URL (derived), `bio`, `country_code` (APPROVED D-G1-09: ISO alpha-2 only, never `ONLINE`), `game_key`, `game name`, `ign`, `primary_role`, `play_modes`, `region_code` (game-specific vocabulary; `ONLINE` only where applicable), `availability`.

Never public (APPROVED D-G1-03):
- `user_id`/`auth` UID, email, phone, `game_user_id` (G1 omits; masked last-4 remains OPEN under D-G1-04 and is not decided here), evidence paths/IDs, precise timestamps (`created_at`/`updated_at` omitted — no year-exposed fallback), suspension/reason fields, internal IDs (`player_game_profiles.id`).

Owner-private (owner reads own base rows; others get projection only):
- `avatar_path` raw, exact timestamps, `is_discoverable`/`is_visible` flag values of others (inferred only via visibility, never returned), `game_user_id`.

## 6. Public projection requirements (APPROVED D-G1-03: RPC-only)

- Single source: the two RPCs `search_player_directory` and `get_player_by_handle` (defined in 05) encode the frozen allowlist + consent predicates (`is_discoverable AND is_visible AND status='active' AND is_active`) + active-status check. No ad-hoc `select *` on base tables from any client or server component for others’ data. No broad public views.
- Masking: `game_user_id` omitted in G1 per D-G1-03; masked `****1234` remains OPEN under D-G1-04 (legacy `****+right(id,4)` pattern noted for reference only; not approved).
- No contact surface: no email, no social handles, no external links in G1 projection. Future `external_link` (cf. legacy teams) stays private until an application-acceptance flow reveals it.
- Pagination/cursor must not leak total counts of private rows; counts derived from projection only. `LIMIT` max 48 with bounded `OFFSET` (see 05); public search and handle-availability endpoints require throttling (numeric limits not invented here — product to approve in D-G1-05/D-G1-08 context without silently closing those decisions).

## 7. Data deletion and retention considerations

- Profile delete → game profiles cascade (DB) + avatar objects deleted (app storage cleanup) + projection rows vanish (predicate).
- Account delete → `app_users` delete cascades player + game profiles; avatars cleaned; auth user deleted last (see 02).
- Backups/PITR may retain data per platform retention; disclosed in privacy copy (platform-level, not G1 code).
- Logs: no PII in application logs; handle in URLs is the only user-controlled string in access logs — acceptable, but error payloads must not echo bio/identifiers.
- No analytics export of private fields in G1.
