# 04 — Account Deletion and Retention

## Existing architecture

G1 `deletePlayerProfile` deletes the canonical player profile (and cascaded game profiles). It does **not** delete `app_users` / Auth identity.

Ownership cases FK → `app_users`, so profile delete alone would leave evidence objects accessible to the still-valid session.

## Implemented cleanup (M2B.3C)

`cleanupOwnBgmiOwnershipEvidence` runs inside `deletePlayerProfile` **after** avatar Storage cleanup and **before** profile row delete:

1. Withdraw every active case (`draft` / `pending_review` / `id_mismatch`)
2. Delete returned Storage objects (+ prefix sweep)
3. Fail closed (`ProfileDeletionError`) if Storage removal fails
4. Preserve withdrawn case rows as minimal non-sensitive audit (status + timestamps; claim cleared)

## Not in scope

- Whole Auth account purge (still excluded by D-G1-07)
- Cross-project LMS cleanup
- Reviewer forensic retention beyond withdrawn audit rows
