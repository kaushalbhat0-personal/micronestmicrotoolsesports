# 05 — Workspace Authorization Browser E2E (P14-D7)

Team under test (before cleanup): `97d0d084-ba13-4b71-8dce-6777360c1159`  
Public slug: `p14d7-public-20261113005330`

## Owner — settings

| Step | Expected | Actual |
| --- | --- | --- |
| Open `/workspace/teams/{id}/settings` | Editable form + owner permissions copy | PASS |
| Update name → Save | “Settings saved.” | PASS |
| Persist in DB | Name updated | PASS (`P14 D7 Public Squad Updated`) |
| Audit | `team.settings_updated` written | PASS (events: `team.created`, `team.settings_updated`) |

## Captain — mutation (RPC, same writer as UI)

`update_team_settings` as captain JWT → HTTP **200** — PASS (captain may edit).

## Denied roles — RPC (direct URL equivalent)

| Role | HTTP | Body | Mutation |
| --- | --- | --- | --- |
| co-captain | 403 | `not authorized` | none intended |
| player | 403 | `not authorized` | none intended |
| sub | 403 | `not authorized` | none intended |
| outsider | 403 | `not authorized` | none intended |

## Player — browser direct settings URL

After cookie login as player, open settings URL:

- Heading **“Read-only for members”**
- No save form / no misleading success
- Permissions copy: membership read-only

PASS — hiding a button alone is not the gate; server/UI deny both present.

## Anonymous

`/workspace/teams` after logout → Sign in prompt (no managed teams leaked) — PASS.
