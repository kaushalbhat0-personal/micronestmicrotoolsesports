# 05 — Security Test Plan (P14-D2)

Two lanes. Do **not** claim RLS verified via elevated MCP SQL.

| Lane | Proves |
| --- | --- |
| **Static** | Zod/domain, SQL text contracts, kill switch, projection key-sets, migration archival presence |
| **Runtime JWT/PostgREST** | Disposable DB or authorized staging with anon + authenticated JWTs (verified/unverified/suspended/owner/captain/member/cross-team) |

---

## Exact cases

### Identity gates (A5)

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-01 | Verified + active user calls `create_team` | Success; owner + captain row + audit | Runtime |
| T-02 | Unverified email (`email_confirmed_at` null) | Permission denied; no rows | Runtime |
| T-03 | Suspended `app_users` | Permission denied; no rows | Runtime |
| T-04 | Anon `create_team` | Denied | Runtime |

### Team creation / concurrency

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-05 | Happy create | Atomic team + captain membership + `team.created` audit | Runtime |
| T-06 | Duplicate slug concurrent | One wins; other unique violation / conflict; no orphan member | Runtime |
| T-07 | Create with smuggled `owner_user_id` in app input | Zod rejects (static); RPC ignores/forbids | Static + Runtime |

### Settings permissions (A1)

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-08 | Owner updates settings | Success + audit | Runtime |
| T-09 | Active captain updates settings | Success + audit | Runtime |
| T-10 | Co-captain updates settings | Denied | Runtime |
| T-11 | Ordinary member updates settings | Denied | Runtime |
| T-12 | Cross-team captain updates foreign team | Denied | Runtime |
| T-13 | Suspended owner updates | Denied | Runtime |

### Unauthorized escalation / immutables

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-14 | Direct UPDATE `owner_user_id` | Trigger/grant deny | Runtime |
| T-15 | Direct UPDATE `slug` / `game_key` | Deny | Runtime |
| T-16 | Member self-UPDATE role → captain | No client UPDATE path; deny | Runtime |
| T-17 | Direct INSERT `team_members` | Deny (no grant/policy) | Runtime |
| T-18 | Direct INSERT/UPDATE/DELETE `team_audit_events` | Deny; UPDATE/DELETE trigger | Runtime |

### Privacy (A3)

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-19 | Anon `search_teams` / `get_team_by_slug` | Public columns only; count only | Runtime |
| T-20 | Public projection key-set exact | No owner/member ids | Static + Runtime |
| T-21 | Private/`archived` slug | Empty ≡ missing | Runtime |
| T-22 | Workspace roster as member | Sees teammate identities for **own** team only | Runtime |
| T-23 | Workspace roster as non-member | No rows / deny | Runtime |
| T-24 | Anon SELECT `team_members` | Deny | Runtime |

### Last-owner / transfer deferred (A2)

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-25 | No transfer RPC exists | Catalog/static assert | Static |
| T-26 | If any leave path exists for owner | Must deny when would leave zero owner | Runtime (when implemented) |

### Audit

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-27 | Create writes `team.created` | One row; actor = creator | Runtime |
| T-28 | Settings writes `team.settings_updated` | One row | Runtime |
| T-29 | Audit UPDATE/DELETE | Exception | Runtime |

### Regression

| ID | Case | Expect | Lane |
| --- | --- | --- | --- |
| T-30 | Player directory RPC key-set unchanged | Frozen G1 projection | Static + Runtime |
| T-31 | `WORKSPACE_WRITES_ENABLED` remains false until flip | Static pin | Static |
| T-32 | Archived D1 02–04 absent from `supabase/migrations/` | Static | Static |

---

## Execution notes

- Runtime identities: dedicated test users (verified, unverified, suspended, owner, captain, co-captain, member, foreign).  
- Prefer PostgREST via anon key + user JWTs, not service_role, for policy proof.  
- Retarget historical D1.5.1 static SQL tests away from archived paths onto P14 SQL once authored.
