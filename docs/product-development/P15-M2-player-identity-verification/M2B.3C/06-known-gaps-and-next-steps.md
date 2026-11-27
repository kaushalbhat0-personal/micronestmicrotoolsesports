# 06 — Known Gaps and Next Steps

## Remaining risks

| Gap | Notes |
|---|---|
| Authenticated Playwright end-to-end upload | Requires durable test login; smoke covers signed-out gate |
| Storage download lag after delete | Listing used for post-withdraw assertion; download may lag briefly |
| Whole Auth account deletion | Still out of G1 scope; cases cascade only when `app_users` deleted |
| Orphan sweeper cron | Still optional enhancement |

## M2B.4 next

- Reviewer queue + approve/reject
- `admin_audit_logs` writes
- Refuse approve on `id_mismatch`
- Badge rules without widening the frozen 12-field projection
