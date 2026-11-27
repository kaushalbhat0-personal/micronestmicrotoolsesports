# P15-M2B.3A — Private BGMI Verification Evidence Architecture & Storage Audit

**Milestone:** Architecture / security audit only (no implementation)  
**Branch:** `new-platform`  
**HEAD:** `890e16c`  
**Supabase:** Esports `knniommcyyhbyiwljisk` (linked; LMS not listed)

## Verdict

**PASS**

Existing `private-verification` bucket is private, MIME/size-limited, and owner-path RLS’d for INSERT/SELECT/DELETE. It is suitable for reuse with **app-layer** restrictions (images-only for player evidence, max two files, magic-byte validation, metadata cases, signed-URL minting for reviewers). No player evidence workflow code exists yet. Admin primitives (`platform_admins` / `is_super_admin` / `admin_audit_logs`) exist for M2B.4.

## Locked decisions preserved

Private evidence · max two screenshots · manual review later · no public projection widen · never avatars/Share Kit · BGMI ID via `game_user_id`.

## Key verified facts

| Item | Fact |
|---|---|
| Bucket `private-verification` | `public=false`, 5 MB, png/jpeg/webp/**pdf** |
| Storage policies | Owner insert/read/delete on `{uid}/…` (delete policy name says “pending” but predicate is folder-only); **no UPDATE**; **no anon/public read** |
| App usage of private bucket | **None** today (avatars use `public-avatars` only) |
| Magic-byte validation | **Absent** (avatars validate declared MIME + size only) |
| Player ownership cases table | **Absent** |
| Signed URL helpers for evidence | **Absent** |

## Deliverables

| # | File |
|---|---|
| 1 | `README.md` |
| 2 | `01-current-storage-audit.md` |
| 3 | `02-evidence-submission-lifecycle.md` |
| 4 | `03-storage-and-authorization-design.md` |
| 5 | `04-upload-validation-and-sanitization.md` |
| 6 | `05-data-model-and-migration-design.md` |
| 7 | `06-security-threat-model.md` |
| 8 | `07-implementation-plan.md` |
| 9 | `08-acceptance-criteria.md` |
| 10 | `09-open-decisions-and-risks.md` |

## Legend

- **Verified** — inspected in migrations and/or live Esports DB  
- **Proposed** — architecture for M2B.3B/C  
- **Open** — needs owner decision  

## Explicit non-changes

No application code, migrations, Storage policies, or hosted configuration were modified in M2B.3A.
