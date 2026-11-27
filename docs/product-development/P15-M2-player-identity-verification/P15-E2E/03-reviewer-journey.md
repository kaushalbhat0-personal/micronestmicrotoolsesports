# 03 — Reviewer journey

## Operator manual path

**Not completed** — durable `platform_admins` empty (see `01`). After grant, operator should:

1. Sign in manually (password never entered into repo/agent).
2. Open `/workspace/moderation` → **BGMI ownership evidence**.
3. Inspect queue card (claimed ID visible to reviewer only).
4. **Inspect (60s)** → open signed preview (do not screenshot query string).
5. Approve with internal reason.
6. Confirm player settings show approved copy; public profile shows “BGMI ownership evidence reviewed”.
7. Confirm `admin_audit_logs` gained `bgmi_ownership.approve` (no Storage paths / tokens).

## Automated JWT path (PASS — 8/8)

Ephemeral reviewer in `platform_admins` for test run only:

| Step | Result |
| --- | --- |
| List pending queue | Super-admin only |
| Mint 60s evidence URL | After authz; unauthorized denied |
| Approve when IDs match | Case → `approved`; audit written |
| Duplicate decision | Rejected |
| Self-review | Forbidden |
| Public badge after approve | `ownership_reviewed=true`, label set; no BGMI ID in payload |

## Audit

`admin_audit_logs` actions `bgmi_ownership.approve` / `.reject` observed during JWT runs (append-only). Ordinary user forge insert denied.
