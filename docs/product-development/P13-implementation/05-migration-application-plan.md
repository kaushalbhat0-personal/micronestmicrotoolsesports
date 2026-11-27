# 05 — Migration application plan (NOT EXECUTED — plan only)

## Current state (per `01-supabase-preflight.md`)

Remote = G1-complete, zero user rows, `bgmi` seed. Local history ahead by
name-mismatched G1 versions + genuinely-new files. **No reset. No repair.
No push executed in P13-A.**

## Step 0 — Authorizations required before any command

1. Owner sign-off on this plan referencing exact file hashes (§4).
2. Stage-3/4 authorization per P12 `verification-and-activation-sequence.md`
   (replay + application authorization with named applier, target ref
   `knniommcyyhbyiwljisk`, and rollback readiness).

## Step 1 — History alignment (forward-only, no data change)

After content-equivalence acceptance (§4 inventory: policies/functions/
triggers/tables all G1-present), mark exactly the 7 local G1 versions as
applied without running them:

```powershell
npx supabase migration repair --status applied 20261110000003 20261110000004 20261110000005 20261110000006 20261110000007 20261111000008 20261111000009
```

Verify with `npx supabase migration list` (7 rows flip local→remote matched).
If ANY row does not flip as expected, stop — do not proceed to push.

## Step 2 — Push genuinely-new files only

```powershell
npx supabase db push
```

Expected set (in order): D1 01–04, P9 05–06, P11 01–03, P13-A 04–05. Confirm
with `migration list` that every local version shows a remote match and that
no unrelated version appears.

## Step 3 — Post-push verification (read-only)

Re-run the §4 inventory queries: new tables (`platform_admins`,
`organizers`, `organizer_members`, `tournaments`, `moderation_reports`,
`verification_cases`, `moderation_decisions`), new functions
(`is_super_admin`, guards, `provision_organizer`, hash, validator, masked
RPCs), new policies/triggers. Re-run `npm test` (P3 projection suites must
stay green against the unchanged RPC text — RPCs are new but text-identical
to reviewed).

## Step 4 — Bootstrap + switch sequence (separate phase, NOT P13-A)

Per P12 stage 6–10: provision test organizer, verify audit, review queue
checks, then one switch at a time with evidence. Switches stay OFF until then.

## Abort rules

- Any command targeting a different ref/project → stop (never touch `whitelabel-lms`).
- Any prompt suggesting reset, destructive SQL, or data change → stop and report.
- Any drift between plan and `migration list` output → stop, re-preflight.
