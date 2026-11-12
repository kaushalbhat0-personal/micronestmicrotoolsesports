# P11 deferred decisions

Explicitly NOT decided, NOT approved, and NOT built in P11.

1. **Moderation authority + operating parameters** (P10-04): unchanged —
   the F-01 trigger references `is_super_admin()` but no authority is
   approved, no moderator power granted, queue has zero policies.
2. **Verification evidence policy** (P10-05): unchanged — no intake, no
   approval action, no expiry job.
3. **F-03 bootstrap implementation**: recommended (`admin_provisioned`) but
   NOT approved and NOT built — no claim/provision code, policy, or grant.
4. **F-02 relaxation set**: strict default proposed; any per-field
   relaxation needs owner approval + migration edit.
5. **`is_public` tightening**: noted as a possible follow-up; not in the
   F-01 trigger by design (fail-safe direction preserved).
6. **Queue authority migration**: moderator-only policies, assignment
   workflow, reviewer SLA, retention/visibility rule, retention purge job —
   all open; the queue stays inert until they land.
7. **Evidence storage**: out of scope entirely (no columns, no bucket, no
   upload surface).
8. **Report rate limiting + duplicate collapsing**: specified as future
   app/DB work; nothing to abuse while intake is disabled.
9. **Organization linkage, professional class, media, organizer filter**:
   carried open from P10, untouched.
10. **Migration application + disposable replay**: not authorized; the
    replay prescription grows to G1 → P9 → P11 in order.
