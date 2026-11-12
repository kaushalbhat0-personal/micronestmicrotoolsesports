# 05 — Team Workspace Contract (P14-D1)

**Routes:** `/workspace/teams`, `/workspace/teams/[id]`, `/roster`, `/settings`  
**Readers:** `listManagedTeams`, `getManagedTeam`, `listTeamRoster`  
**Writers:** gated (`WORKSPACE_WRITES_ENABLED = false`); actions return disabled message  
**UX:** mobile-first; no complex dashboards.

---

## 1. Surfaces

### Index — `/workspace/teams`

| Element | Contract |
| --- | --- |
| Purpose | List teams the caller owns, captains, or (read-only) belongs to |
| Data | `ManagedTeam[]` with caller's own `role` basis only |
| Unauthenticated | Sign-in prompt |
| Empty | Honest empty + link to create (create remains disabled until writes enabled) |
| Unavailable | Generic unavailable (covers missing tables / RLS failures) — no enumeration |

### Overview — `/workspace/teams/[id]`

| Element | Contract |
| --- | --- |
| Purpose | One-team overview: identity fields + management basis + nav |
| Links | Settings, roster, public profile (`/teams/[slug]`) when public |
| Unauthorized / invisible | Treat as unavailable/not-found equivalence (no cross-team leak) |

### Settings — `/workspace/teams/[id]/settings`

Editable when writes enabled and role ∈ `{owner, captain}` (proposed):

- name, description, region_code, current_level, target_level, recruiting, is_public

Immutable / never in patch:

- slug, game_key, owner_user_id, created_by, organization_id, id

### Roster — `/workspace/teams/[id]/roster`

| Field rendered | Notes |
| --- | --- |
| role | Membership role label |
| game_role | Nullable |
| is_self | Boolean marker |
| key | Opaque React key — **never show raw user id** |

Add/remove/role-change controls: **absent** until membership RPCs + D1-D3/D1-D12 approved.

---

## 2. Action ownership

| Action | Owner | Captain | Member | Notes |
| --- | --- | --- | --- | --- |
| View overview | Y | Y | Y (read-only) | |
| Edit settings | Y | Y (proposed) | N | Kill-switched today |
| View roster list | Y | Y | OPEN privacy | Default-deny identities in public; workspace may show teammates when approved |
| Appoint captain | Y | N | N | Future RPC |
| Remove member | Y | Y (proposed) | N | Future RPC |
| Self-leave | special | Y | Y | Owner: transfer-first |
| Transfer ownership | Y | N | accept only | Future RPC |
| Recruitment settings | Y | Y | N | P3 — not foundation |
| Team-game config | view only | view only | view only | `game_key` immutable; no multi-game UI |
| Membership history | Y | Y | N | Prefer audit table later; omit heavy UI in v1 |

---

## 3. Creation entry points

**Recommended single path after enablement:**

1. Authenticated user opens `/teams/new`.
2. Form posts to `createTeamAction` (session-derived owner).
3. On success, redirect to `/workspace/teams/[id]`.

Today: form disabled; workspace actions exist but always disabled; form **not** wired to action — fix at implementation time (wiring only after decisions + migrations).

---

## 4. States (workspace)

| State | UI |
| --- | --- |
| Sign-in required | `WorkspaceSignInPrompt` |
| Loading | `WorkspaceSkeleton` |
| Empty | `WorkspaceEmpty` |
| Unavailable | `WorkspaceUnavailable` |
| Permission note | Explain owner vs captain vs member; state writes disabled honestly |
| Validation error | Generic; no PostgREST leakage |
| Disabled write | Explicit “nothing was saved” message |

---

## 5. Mobile-first constraints

- Single-column layouts (`max-w-3xl` / `max-w-5xl` already used).
- Touch targets ≥44px; focus-visible outlines.
- Avoid multi-panel dashboards, stat strips, or invented KPIs.
- One job per screen: list → overview → settings OR roster.

---

## 6. What workspace must never show

- Other users' private applications
- Cross-team data
- Service-role errors / SQL detail
- Organization authority inferred from `organization_id`
- Fabricated member performance metrics
