# 16 — P13-C0 owner authorization template (PROPOSED — awaiting completion)

This template grants NOTHING until every field is filled by the owner and a
named applier, and the signed record is stored alongside the evidence log.
Do not invent names, signatures, timestamps, or approvals — all fields below
are blank by design. The operation (docs 13–14) and the runtime battery
(doc 15) must NOT run until this record is complete; the battery additionally
needs its own explicit approval in §7.

## 1. Scope reference (pre-filled by preparer, verified by owner)

- Target project ref: `knniommcyyhbyiwljisk`
  (`micronestmicrotoolsesports`, ap-northeast-1, PG 17.6.1.171).
- Source branch / HEAD: `new-platform` / `376df8f651f3142dcaacb2ddbcbf269b38196040`.
- Packet documents: `12` (manifest), `13` (repair plan), `14` (push plan),
  `15` (test runbook), `17` (final report), this template `16`.

## 2. Owner approval

- Owner approval: [ ] GRANTED / [ ] DENIED — Owner: ____________________
  (name, NOT invented by preparer) — Date/time (UTC): ____________________
  — Signature/record: ____________________.

## 3. Named applier

- Applier (single accountable human): ____________________ — accepted at
  (UTC): ____________________. No other person may issue the §4 commands.

## 4. Exact seven repair mappings approved

The owner confirms the seven remote→local mappings in doc 13 §1:

| # | Remote version → local version | Approved |
| - | ------------------------------ | -------- |
| 1 | `20261110135602` → `20261110000003` | [ ] |
| 2 | `20261110135654` → `20261110000004` | [ ] |
| 3 | `20261110141108` → `20261110000005` | [ ] |
| 4 | `20261110143759` → `20261110000006` | [ ] |
| 5 | `20261111072251` → `20261110000007` | [ ] |
| 6 | `20261111090645` → `20261111000008` | [ ] |
| 7 | `20261111091947` → `20261111000009` | [ ] |

No other version is approved for repair. Additions void this record.

## 5. Exact 11 migration hashes approved

The owner confirms each SHA-256 from doc 12 §2 (re-verify with doc 14 §4
before pushing; any mismatch voids the approval):

| # | Version | SHA-256 (first 16 shown; full hash in doc 12) | Approved |
| - | ------- | --------------------------------------------- | -------- |
| 1 | 20261112000001 | `90e6f4633a96eb4c…` | [ ] |
| 2 | 20261112000002 | `2f4e0ac6686f620d…` | [ ] |
| 3 | 20261112000003 | `5209c028f2091da6…` | [ ] |
| 4 | 20261112000004 | `554ed952c2c16267…` | [ ] |
| 5 | 20261112000005 | `b8b747c6e3a174bf…` | [ ] |
| 6 | 20261112000006 | `12cc0c8d74480a9d…` | [ ] |
| 7 | 20261113000001 | `3ae4054c86552f7f…` | [ ] |
| 8 | 20261113000002 | `a39178066d934b6…` | [ ] |
| 9 | 20261113000003 | `1ca6e2fd857bb1e…` | [ ] |
| 10 | 20261113000004 | `aa3dad7ccf808454…` | [ ] |
| 11 | 20261113000005 | `e2289ce09195f6f8…` | [ ] |

## 6. Explicit confirmations (all REQUIRED, all initialled by owner)

- [ ] No reset is authorized in any window of this operation.
- [ ] All three write switches (`ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED`)
  remain OFF through repair, push, inventory, and the runtime battery.
- [ ] No second Supabase project, no branch, no Docker path is authorized.
- [ ] No migration file edit and no history edit beyond the seven §4 marks.
- [ ] No user-data modification; no real user record used in any probe.
- [ ] D-02/D-03/D-05/D-09 stay deferred; `verification_cases` stays inert.
- [ ] Rollback readiness acknowledged (doc 14 §7); any failure stops the
  sequence and is reported, never retried blindly.

## 7. Separate post-push runtime-test approval (NOT covered by §§2–6)

- Runtime battery (doc 15, `rt-*` identities + cleanup + audit retention)
  approved: [ ] YES / [ ] NO — approver: ____________________ — date/time
  (UTC): ____________________. The battery runs only after doc 14 §6 is
  green and its evidence log is opened first.
- No switch flip and no launch claim is authorized by this record.

## 8. Approval timestamp and filing

- Completed at (UTC): ____________________ — filed at (evidence log path):
  ____________________. Unsigned / partially-initialled copies are drafts,
  not authority.
