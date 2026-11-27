# 09 — Test and Verification Plan (P14-D1)

Separate **static** proof from **runtime PostgreSQL/RLS** proof.  
Do **not** claim RLS verification via elevated MCP SQL execution.

---

## 1. Lanes

| Lane | Tooling | Proves |
| --- | --- | --- |
| Unit / static | Vitest | Domain, Zod, SQL text contracts, kill switches, projection key-sets |
| Integration (embedded PG) | Existing repo harness if available | Constraints, RPC logic under real PG |
| Runtime RLS replay | Disposable DB + anon/authenticated JWTs | Policies, grants, isolation |
| E2E | Playwright | Mobile UI, a11y locators, honest empty/error states |
| Manual | Owner checklist | Product copy, visual Competitive Arena fit |

---

## 2. Domain & Zod

- Competitive levels / roles / region enums reject unknowns.
- `teamSchema` / `createTeamInputSchema.strict()` reject smuggled `owner_user_id`, `organization_id`, etc.
- `updateTeamSettingsSchema` rejects slug/gameKey/ownership.
- Directory input clamps (limit/offset/query length).
- Matching never sets `verified=true`.
- Multititle contract: BGMI-only enablement until catalogue expands.

**Existing anchors:** `teams-domain.test.ts`, `multititle-contract.test.ts`, workspace schema tests.

---

## 3. Database constraints

| Case | Expect |
| --- | --- |
| Duplicate slug | Unique violation |
| Invalid slug/level/region | CHECK failure |
| Orphan `game_key` | FK failure |
| Duplicate `(team_id,user_id)` | Unique violation |
| Inactive captain role | CHECK failure (when modeled) |
| Delete `app_users` owning a team | RESTRICT blocks |

---

## 4. RLS & RPC authorization (runtime)

Identity matrix for each mutation/read:

| Caller | search_teams | get_team_by_slug | teams SELECT other | team_members INSERT | create_team | update settings | transfer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| anon | public only | public only | deny | deny | deny | deny | deny |
| auth active non-member | public only | public only | deny | deny | allow† | deny | deny |
| owner | + | + | own | deny (RPC) | — | allow† | allow† |
| captain | + | + | own team | deny | — | allow† | deny |
| member | + | + | own team | deny | — | deny | deny |
| suspended | public read OK | public read OK | deny writes | deny | deny | deny | deny |
| cross-team captain | cannot mutate foreign team | | | | | | |

† When product-approved and kill switch on.

Additional cases:

- Cross-team isolation (captain A vs team B)
- Concurrent dual accept / dual leave (unique + lock)
- Last-owner leave/transfer denied
- Ownership transfer happy path + reject non-member target
- Private slug ≡ missing slug
- Public projection excludes private keys (exact key-set)
- LIKE escape probes and limit/offset clamps
- `member_count` ignores non-active statuses

---

## 5. Public privacy

- Reader maps unknown keys → operation error (existing tests).
- Route static audit: public pages do not `.from('teams')` base selects.
- Metadata built only from public card fields.

---

## 6. Search / filter / pagination

- Route `parseTeamsQuery` drops invalid params.
- Page bounds (1..42); over-fetch next detection.
- Unknown game → zero rows fail-closed.
- No recruiting filter unless RPC gains param (then add tests; until then assert absence).

---

## 7. Mobile UI & accessibility

- Directory / profile / workspace at ~390px: no horizontal overflow.
- Focus-visible, 44px targets, `aria` on pagination/filters/status/alert.
- Empty/error copy honest; no fabricated counts.
- Prefer role/label selectors in Playwright (project playwright skill).

---

## 8. Error states

| Surface | Assertion |
| --- | --- |
| Directory RPC down | alert + retry, no fake cards |
| Workspace pre-migration | unavailable, not empty-success lie |
| Disabled writes | explicit disabled message; DB untouched |
| Validation | generic validation error |

---

## 9. What static tests already cover (keep green)

- `team-security-boundary.test.ts` (historical D1.5.1 clauses — retarget to P14 SQL when rewritten)
- `application-insert-boundary.test.ts` (only if applications table retained)
- `workspace-writer` gate + `routes.test.ts` write-switch pin
- App route audits for teams + workspace

When superseding D1 SQL, **update static fixtures** to new file paths/clauses; do not leave tests asserting retired SQL.

---

## 10. Exit criteria before write enablement

1. Runtime RLS/RPC matrix green on disposable DB.  
2. Kill-switch tests updated intentionally.  
3. E2E create/settings flows against disposable or staging only.  
4. Owner sign-off on open decisions affecting authZ.  
5. G1 player projection regression green.
