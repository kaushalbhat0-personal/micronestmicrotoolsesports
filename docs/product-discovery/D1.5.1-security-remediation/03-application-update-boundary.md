# 03 — Application Update Boundary (F-T02)

## Design

Three layers, applicant-only, withdraw-only:

1. **RLS:** `"applications applicant withdraw"` USING
   (`applicant = auth.uid()` AND `status IN (applied, shortlisted)`) WITH CHECK
   (`applicant = auth.uid()` AND `status = 'withdrawn'` AND `decided_by/decided_at
   IS NULL`). Old→new transition enforced at the row gate.
2. **Grants:** `UPDATE (status, updated_at)` only — `post_id, applicant_user_id,
   note, decided_*, created_at` are unwritable via PostgREST.
3. **Trigger:** `enforce_application_withdraw_boundary()` re-checks all of the
   above (reassignment, non-null `decided_*`, transition window, note/created_at
   immutability) so a future grant widening cannot silently reopen forgery.

No captain UPDATE path is added: `accepted/shortlisted/declined` remain
unreachable via direct writes (F-T05 BLOCKED). Service-role/app flows bypass
RLS/grants but not the trigger — deliberate, so the withdraw-only invariant
holds for privileged writers too until the captain RPC lands.

## Limitation (documented, not silently resolved)

Applicant note edits via UPDATE are now impossible; the supported path is
withdraw + reapply. Captain accept/shortlist/decline has no path at all. Both
need the recruitment-lifecycle + D1-D3 decisions.

## Files

- SQL: `supabase/migrations/20261112000003_d1_security_remediation.sql` §E.
- Tests: `src/features/teams/tests/team-security-boundary.test.ts` ("F-T02" blocks).
