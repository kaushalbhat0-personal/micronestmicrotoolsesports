# 04 — Audit trail

## Writer

Decisions write into `admin_audit_logs` inside `decide_player_bgmi_ownership_case` (same transaction as decision + case update), matching the P13 `provision_organizer` pattern. There is no generic authenticated `record_admin_audit` for players.

## Recorded fields

| Field | Value |
| --- | --- |
| `actor_user_id` | Reviewer `auth.uid()` |
| `action` | `bgmi_ownership.approve` / `bgmi_ownership.reject` |
| `target_type` | `bgmi_ownership_case` |
| `target_id` | Case UUID |
| `reason` | Internal reason (bounded) |
| `after_state` | `{ decision, player_id, decision_id, evidence_count }` |

No screenshots, signed URLs, Storage paths, or tokens.

## Append-only

`prevent_admin_audit_mutation` blocks UPDATE/DELETE. Ordinary users have no INSERT grant; forge attempts fail (integration-tested).

## Hotfix applied in M2B.4

`admin_audit_logs_action_check` was double-escaped in the D1 foundation so only `domain\.action` (literal backslash) passed. Migration `20261128000005_…` restores `$re$^[a-z_]+\.[a-z_]+$$re$`.
