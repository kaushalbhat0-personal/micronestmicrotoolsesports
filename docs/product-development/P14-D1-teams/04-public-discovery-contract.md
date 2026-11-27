# 04 — Public Discovery Contract (P14-D1)

**Routes:** `/teams`, `/teams/[slug]`  
**Reader:** `src/features/teams/server/team-directory-reader.ts`  
**RPC pair:** `search_teams`, `get_team_by_slug`  
**Invariant:** do not silently change G1 player directory contracts.

---

## 1. Exact public projection

### Card / search row (9 columns, order frozen)

| Column | Type | Source |
| --- | --- | --- |
| `id` | uuid | teams.id |
| `slug` | text | teams.slug |
| `name` | text | teams.name |
| `game_key` | text | teams.game_key |
| `region_code` | text | teams.region_code |
| `current_level` | text | teams.current_level |
| `target_level` | text | teams.target_level |
| `recruiting` | boolean | teams.recruiting |
| `member_count` | bigint | count of **active** members only (recommended semantics) |

### Detail adds

| Column | Type |
| --- | --- |
| `description` | text \| null |

### Predicate

`teams.is_public = true` AND recommended `lifecycle_status = 'active'` (when column exists).

### Explicitly excluded

- `owner_user_id`, `created_by`, `organization_id`
- timestamps
- membership rows / user IDs / handles (unless a future **approved** public roster projection)
- pending invitations/applications
- private notes, reports, moderation state
- contact channels, emails
- verification badges (none in v1)
- invented stats / achievements / rankings

Compile-time key-set guards in `domain/team-directory.ts` must remain.

---

## 2. Search behavior

| Input | Rules |
| --- | --- |
| `query` | Optional; trim; 1–120 chars; matches `name` OR `slug` via escaped ILIKE |
| Empty / absent | No text predicate |
| Invalid | Dropped at route boundary; notice lists invalid filter names |

LIKE specials (`%`, `_`, `\`) must be escaped (D1.5.1 F-T06 parity). Unknown game keys fail closed to zero rows at reader/SQL.

---

## 3. Filters — supported vs not

| Filter | Supported by current/proposed RPC? | Notes |
| --- | --- | --- |
| Game | Yes (`p_game`) | Catalogue-aligned |
| Region | Yes (`p_region`) | Exact `region_code` match |
| Query | Yes (`p_query`) | See §2 |
| Recruiting | **No param today** | Display-only on cards; adding `p_recruiting` is a **contract change** |
| Level (current/target) | **No** | Do not invent client-side filtering of full sets |
| Lifecycle / status | **No** (implicit active+public) | Do not expose archived |
| Sort options | Fixed `created_at desc` | No client sort param in v1 |

**Pagination**

- Page size: **24** (`TEAMS_PAGE_SIZE`)
- Max page: **42** (offset ceiling 1000)
- Over-fetch +1 row to detect next page without total counts
- URL: 1-based `page`; page 1 omitted from shareable href

---

## 4. Public roster visibility

**Current shipped UI:** member **count only** + privacy note; no identities.

**Contract for foundation:** public roster identities remain **hidden** until an explicit product approval. Do not render handles/IGNs on `/teams/[slug]` by default.

If later approved, publish a **separate** masked roster RPC with its own column freeze — never widen `get_team_by_slug` ad hoc.

---

## 5. States

| State | Behavior |
| --- | --- |
| Loading | `TeamsResultsSkeleton` / Suspense |
| Empty | Honest empty copy + reset filters control |
| Invalid filters | Amber status notice; continue with valid filters |
| Unavailable / RPC missing | Error / alert retryable — **no fake teams** |
| Detail missing or private | Identical `notFound()` (404-equivalence) |
| Detail transport error | Route error boundary (no existence leak for validation errors) |

Metadata: `robots: { index: false, follow: true }` (directory and detail). Canonical only when `NEXT_PUBLIC_APP_URL` configured.

---

## 6. Copy constraints

- Levels: always “self-reported” where shown.
- No “verified team”, tournament wins, or ranking claims.
- Marketing must not claim Teams as live until RPCs are applied and verified (homepage RoadmapStrip still “planned” until liveness).

---

## 7. Compatibility

- Player directory projection, RPCs, and routes are **out of scope** for mutation.
- Shared game/region vocabularies may be reused; do not couple readers.
- Teams discovery remains RPC-only for anon/authenticated public reads.
