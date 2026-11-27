# P15-M2B.3B — Private BGMI Evidence Backend

**Milestone:** Backend foundation only (no player UI, no reviewer workflow)  
**Branch:** `new-platform`  
**HEAD:** `890e16c`  
**Supabase:** Esports `knniommcyyhbyiwljisk`  
**Migration:** `20261128000002_p15_m2b3b_bgmi_ownership_evidence.sql` (**applied**)

## Verdict

**PASS**

## Locked decisions implemented

| Decision | Implementation |
|---|---|
| Private evidence | `private-verification` + owner RLS |
| Max 2 images | DB CHECK + app gate + trigger |
| JPEG/PNG/WebP only | Magic + sharp sanitize; PDF/SVG/GIF rejected in app |
| 5 MiB original max | App + DB byte_size CHECK |
| Decode/re-encode | `sanitizeBgmiOwnershipImage` (sharp) |
| Immutable while pending | No upload/replace on non-draft; Storage DELETE blocked |
| Withdraw + resubmit | `withdraw_player_bgmi_ownership_case` RPC |
| Immutable `claimed_game_user_id` | Set once in submit RPC; guard trigger |
| ID mismatch non-approvable | Trigger → `id_mismatch` |
| Withdraw deletes objects | RPC clears metadata; app deletes Storage; case audit retained |
| Signed URL 60s | `mintBgmiOwnershipEvidenceSignedUrl` |
| No approve/reject | No decision tables/UI |

## Deliverables

1. `README.md`
2. `01-schema-and-migrations.md`
3. `02-storage-and-rls-implementation.md`
4. `03-secure-upload-processing.md`
5. `04-submission-and-withdrawal-lifecycle.md`
6. `05-rate-limiting.md`
7. `06-security-test-evidence.md`
8. `07-known-gaps-and-next-steps.md`

## Explicit non-starts

M2B.3C (player UI) and M2B.4 (reviewer) not started. No commit / push / deploy. No LMS access.
