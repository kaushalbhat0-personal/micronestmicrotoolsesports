# 14 — P13-C0 ordered push plan (NOT EXECUTED — authorization-gated)

Exact sequence for the authorized window. No mutating command was run in
this phase. Target ref throughout: `knniommcyyhbyiwljisk`.

## 1. Preflight and project-ref confirmation (read-only)

```powershell
git branch --show-current          # REQUIRED: new-platform
git rev-parse HEAD                # REQUIRED: 376df8f651f3142dcaacb2ddbcbf269b38196040
git worktree list                 # REQUIRED: single worktree (repo root)
npx supabase projects list        # REQUIRED: knniommcyyhbyiwljisk, ACTIVE_HEALTHY, PG 17.6.1.171, linked true
npx supabase migration list       # REQUIRED: 01/02 matched; 7 G1 local-only; 7 remote-only dashboard stamps; 11 pending local-only in doc-12 order
```

Stop conditions: any ref mismatch (including any output naming a different
project — never touch `whitelabel-lms`), any HEAD/worktree deviation from
§1 of doc 12, any ledger drift vs the P13-B record. On any of these: STOP,
report, do not proceed.

Optional read-only close-out (nice-to-have, still read-only, NOT blocking):
`pg_indexes` for files 05/06, `role_table_grants` for the grant surface,
`pg_get_functiondef(update_player_handle)` for the file-09 body — via MCP
`execute_sql` SELECT-only. Findings change nothing about the repair
recommendation; record them as evidence either way.

## 2. Seven G1 ledger repairs (MUTATES ledger — authorization required)

```powershell
npx supabase migration repair --status applied 20261110000003 20261110000004 20261110000005 20261110000006 20261110000007 20261111000008 20261111000009
```

Expected output: success marking 7 versions; no DDL text in output.
Full per-version mapping, equivalence evidence, and expected ledger rows
are in doc 13 — the applier must have doc 13 open and confirm each of the
7 versions against it before pressing enter.

## 3. Read-only ledger verification (REQUIRED gate before push)

```powershell
npx supabase migration list
```

REQUIRED result (per docs 12 §1 and 13 §3): 01/02 still matched; all 7 G1
locals flipped to matched; the 11 pending still local-only in exact order;
the 7 dashboard stamps still present in remote history. If ANY row differs:
STOP — do not proceed to push. Re-preflight (§1), report the diff, await
fresh authorization. This gate is what makes a mid-sequence failure
resumable: the ledger shows exactly where the operation stands.

Why repair-before-push is mandatory: without it, `db push` replays
`CREATE TABLE app_users` (and the rest of G1 DDL) against live objects and
fails. After repair, push scope is exactly the 11 genuinely-new files.

## 4. Confirm all 11 pending migrations remain in expected order

Read-only check, no command needed beyond the §3 listing: the 11 local-only
versions must read, in order,
`20261112000001 20261112000002 20261112000003 20261112000004
20261112000005 20261112000006 20261113000001 20261113000002
20261113000003 20261113000004 20261113000005`.
Re-verify hashes against doc 12 §2 before pushing:

```powershell
Get-ChildItem supabase/migrations/20261112*.sql, supabase/migrations/20261113*.sql | Sort-Object Name | ForEach-Object { Get-FileHash $_.FullName -Algorithm SHA256 }
```

REQUIRED: all 11 hashes byte-match doc 12. Any mismatch: STOP (a file
changed after authorization — the authorization no longer covers the push).

## 5. Migration push (MUTATES schema — authorization required)

```powershell
npx supabase db push
```

Expected: applies exactly the 11 files in doc-12 order (D1 01–04, P9 05–06,
P11 01–03, P13 04–05). No other version may appear in the output. Each file
runs in its own transaction (Supabase default).

Immediately after (read-only):

```powershell
npx supabase migration list
```

REQUIRED: every local version shows a remote match; no unrelated version
appears. Then post-push read-only inventory: new tables
(`platform_admins`, `organizer_members`, `organizers`, `tournaments`,
`moderation_reports`, `verification_cases`, `moderation_decisions`,
`admin_audit_logs`, `cron_run_ledger`, team tables), new functions
(`is_super_admin`, guards, `provision_organizer`, hash, validator, masked
RPCs), new policies/triggers per doc 12 §3 — plus `npm test` (P3 projection
suites must stay green), `get_advisors` security/performance, and the
write-switch triple-check (all still `false`).

## 6. Read-only post-push schema and ledger verification

Covered by the second half of §5: ledger fully matched + object inventory +
suites + advisors + switches OFF. Record all outputs in the evidence log.
Any missing object, any suite regression, any unexpected advisor finding:
STOP, report, do not proceed to the runtime battery or any switch discussion.

## 7. Recovery behavior if any command fails

- Repair failure (non-zero exit, partial marking): the ledger shows exactly
  which versions flipped. Do NOT re-run blindly. Record the `migration
  list` output, diagnose (connectivity vs ref vs version typo), and only
  re-issue the command for versions still unmarked — after confirming each
  against doc 13. Never add versions.
- Push failure mid-sequence: each file is its own transaction, so the ledger
  shows an applied prefix and the exact stopping point. Diagnose the failing
  file from the error output (expected causes, in order of likelihood:
  pre-existing object from a skipped repair, a genuine SQL error in one of
  the 11 files, connectivity). Fix-forward only with fresh authorization;
  `db push` is resumable by design. Never follow a failure with `db reset`,
  never hand-edit history, never mark the 11 as applied without executing
  them (that would fake a schema the database does not have).
- Any reset/destructive prompt at any point: STOP, decline, report. No reset
  is authorized in any window of this operation (zero user rows, nothing to
  gain, everything to lose).
- Rollback notes (require their own authorization, recorded here for
  readiness only): P13 04 — drop validator + hash functions, drop the added
  columns + CHECK in reverse creation order. P13 05 — drop the 6 policies +
  `provision_organizer`, re-apply the P9 file-06
  `enforce_tournament_lifecycle` body verbatim (restore source pinned in the
  file header). Earlier files — reverse-drop in dependency order per §08.

## 8. What must never be retried blindly

1. The §2 repair command (re-running it after a partial success without
   checking `migration list` first risks confusion, not damage — but blind
   repetition hides diagnosis).
2. `db push` after a failure (always read the error and the ledger first;
   the failure is evidence, not noise).
3. Anything containing `reset`, `--force`, destructive SQL, branch
   create/merge, or MCP `apply_migration`/`execute_sql` writes — these are
   not retries, they are different, prohibited operations.
4. Push with a hash mismatch (§4) — a changed file voids the authorization.
5. Any command while the terminal context (project ref, linked status) is
   uncertain — re-run §1 first. Five seconds of preflight beats any recovery.
