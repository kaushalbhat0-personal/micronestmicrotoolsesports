# 07 — Known Gaps and Next Steps

## Remaining risks / gaps

| Gap | Severity | Notes |
|---|---|---|
| No player UI wiring (M2B.3C) | Expected | Backend exports ready |
| No reviewer signed-URL / approve (M2B.4) | Expected | Super-admin SELECT on metadata exists; no Storage admin policy |
| No hosted two-JWT Storage integration test | Medium | Policies verified in SQL; add integration in 3C/4 |
| Orphan sweeper cron | Low | Upload compensation deletes on failure; withdraw reports partial failures |
| Account-deletion Storage sweep | Medium | Case rows cascade with `app_users`; Storage objects need explicit cleanup hook |
| Bucket still allows PDF | Low | App rejects; bucket unchanged by design |
| Rate limit not multi-region | Low | Documented |

## M2B.3C next

- Settings UI near BGMI ID: draft/upload/confirm/status/withdraw
- Owner evidence preview via 60s signed URL
- A11y + mobile-first

## M2B.4 next

- Reviewer queue using `is_super_admin()`
- Decision table + `admin_audit_logs`
- Refuse approve when `id_mismatch`
- Badge grant rules without widening 12-field projection incorrectly
