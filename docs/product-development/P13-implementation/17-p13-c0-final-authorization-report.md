# 17 — P13-C0 final authorization report (read-only, 2026-11-12)

P13-B verdict carried in: READY FOR CONTROLLED APPLICATION (technical
verdict, not a launch pass). This phase prepared the operation; it did not
execute it. No repair, no push, no reset, no remote DDL/DML, no Docker, no
second project, no file/history edits, no switch changes, no user-data
modifications, no secret exposure, no commits/pushes/deployments occurred.
Worktree preserved.

## 1. Phase 1 — exact target verification: PASS

- Branch `new-platform`, HEAD `376df8f651f3142dcaacb2ddbcbf269b38196040`
  (expected `376df8f` — match; one non-migration commit on top of the
  P13-A/B `01893ae` base: vercel.json comment fix, no DB impact).
- Single worktree (repo root); all uncommitted work preserved; nothing
  committed, pushed, or deployed.
- Linked project ref exactly `knniommcyyhbyiwljisk`
  (`micronestmicrotoolsesports`, `ACTIVE_HEALTHY`, PG `17.6.1.171`,
  `ap-northeast-1`, `linked: true`) via `projects list`. Sibling project
  never accessed.
- Remote ledger: 9 versions (`01`, `02` + the 7 G1 dashboard stamps below);
  18 local-only; local set 20 files — identical to P13-B, no drift.
- All three write switches OFF, test-pinned. No reset required or justified
  (zero user rows; G1 schema present; discrepancy fully explained).

## 2. Phase 2 — repair authorization matrix: 7/7 mappings reproduced

Single exact command (NOT executed — separate authorization required):

```powershell
npx supabase migration repair --status applied 20261110000003 20261110000004 20261110000005 20261110000006 20261110000007 20261111000008 20261111000009
```

| Remote version / name | Local file (local version) | Expected ledger result |
| --------------------- | -------------------------- | ---------------------- |
| `20261110135602` / `g1_identity_anchor` | `20261110000003_g1_identity_anchor.sql` / `20261110000003` | flips to matched; no DDL |
| `20261110135654` / `g1_identity_anchor_grant_tightening` | `20261110000004_g1_identity_anchor_grant_tightening.sql` / `20261110000004` | flips to matched; grant-only, lowest risk |
| `20261110141108` / `g1_player_profile` | `20261110000005_g1_player_profile.sql` / `20261110000005` | flips to matched; no DDL |
| `20261110143759` / `g1_game_catalogue` | `20261110000006_g1_game_catalogue.sql` / `20261110000006` | flips to matched; seed untouched |
| `20261111072251` / `g1_public_projection` | `20261110000007_g1_public_projection.sql` / `20261110000007` | flips to matched; RPCs untouched |
| `20261111090645` / `g1_owner_settings_lifecycle` | `20261111000008_g1_owner_settings_lifecycle.sql` / `20261111000008` | flips to matched; no DDL |
| `20261111091947` / `g1_handle_function_ambiguity_fix` | `20261111000009_g1_handle_function_fix.sql` / `20261111000009` | flips to matched; body residual recorded |

Full equivalence evidence and stop conditions: doc 13. No unrelated version
may be repaired. Post-repair gate: `npx supabase migration list` must show
all 7 flipped and the 11 pending still local-only — else STOP, no push.

## 3. Phase 3 — migration push manifest: 11/11 hashes verified

Exact push command (NOT executed — authorization required):

```powershell
npx supabase db push
```

Exact ordered manifest (full detail incl. dependencies and per-file
tables/policies/grants/functions/triggers: doc 12):

1. `20261112000001_d1_admin_foundation.sql` — `90e6f4633a96eb4caa320053c4657dfd0623fe42831287adef4767589664b192`
2. `20261112000002_d1_teams_discovery.sql` — `2f4e0ac6686f620d3370532dfe0c02d4632cd5fc5288b8d083a92b034c37e79d`
3. `20261112000003_d1_security_remediation.sql` — `5209c028f2091da643fbfe441f7f2b5357c943d9d625a84a807e0b9e48d741d8`
4. `20261112000004_d1_insert_boundary_indexes.sql` — `554ed952c2c16267aa2e25e8d90c6b3faa2f0b12979510190071b7554b0344c7`
5. `20261112000005_p9_organizer_foundation.sql` — `b8b747c6e3a174bfa7fb713c659c21b21bc7f25ae1e7b386707e9ce7a1be9ef2`
6. `20261112000006_p9_tournament_link.sql` — `12cc0c8d74480a9dcd61cadc347580a38c4bf07c6d6c43410d698448fa948054`
7. `20261113000001_p11_f01_trust_guard.sql` — `3ae4054c86552f7f27af69708bfb9834a2eadfe3229e2f79cdfb47362a207b95`
8. `20261113000002_p11_f02_published_integrity.sql` — `a39178066d934b6ad13086ae1ce89b890913aed8552695c1bf8b504eb6b01b43`
9. `20261113000003_p11_moderation_queue.sql` — `1ca6e2fd857bb1e461039a6da279622c7af2bf9062f68aeb6a76672fe0f7a878`
10. `20261113000004_p13_f02_snapshot.sql` — `aa3dad7ccf8084546c6f99002d6f5391626a175f662b9a8fd3b6ba433eb0dc73`
11. `20261113000005_p13_activation.sql` — `e2289ce09195f6f81cfd69d767a68ad963272ea90f39ffc668400267e9fff0ae`

Cross-check: all five P13-A 12-char prefixes match. Two honest count
corrections vs P13-B §08 prose recorded in doc 12 (D1 02: 15 policies, not
14; D1 03: 6 `CREATE POLICY`, not 5) — file contents govern, hashes govern.
No other version may appear in the push output.

## 4. Phase 4 — exact operation plan

Preflight (§1) → 7 repairs (§2) → read-only ledger gate (§3) → 11-hash
re-confirmation (§4) → push (§5) → read-only post-push inventory + suites +
advisors + switches (§6), with recovery rules and the never-retry-blindly
list (docs 14 §7–§8). Any ref mismatch, reset/destructive prompt, hash
mismatch, or ledger drift: STOP and report. Full sequence: doc 14.

## 5. Phase 5 — post-application test plan

49-case battery (F-01…F-15, P-01…P-10, R-01…R-15, L-01…L-09 from the existing
P13 test plan) grouped into the 12 required coverage areas — RLS isolation,
anon vs authenticated, active-user enforcement, organizer provisioning,
moderator authority, self-review prevention, version increments,
snapshot/hash matching, published immutability, rejection/resubmission,
unpublish/republish, no unauthorized deletion — with `rt-*` test identities,
archival cleanup, audit-row retention, `bgmi` seed parity, no real user
records, switches OFF. Separate approval required before it runs. Full
runbook: doc 15.

## 6. Phase 6 — authorization record

Proposed template: doc 16 — owner approval, named applier, project ref,
seven mappings, eleven hashes, approval timestamp, no-reset confirmation,
switches-OFF confirmation, separate runtime-test approval. All name/
signature/timestamp fields blank by design; nothing invented.

## 7. Remaining honest gaps (unchanged, not hiding)

Real PostgreSQL/RLS/PostgREST runtime enforcement is unverified and
unverifiable until the authorized push + battery (P13-B §08). Static +
simulated coverage stands; function-body text (`09`), grant-surface
exactness, and index inventory stay recorded residuals — none blocks the
recommendation (every promised object present, no extra G1 object, zero
user rows).

## FINAL VERDICT: READY FOR OWNER SIGN-OFF

The packet is complete and self-consistent: target verified with no drift,
seven repair mappings exact, eleven push hashes byte-verified against the
files `db push` would send, operation sequence with stop/recovery rules
recorded, 49-case runtime battery planned with identities and cleanup, and
an authorization template that withholds all authority until signed.
This verdict authorizes nothing by itself — execution (repair, push,
battery) requires the completed doc-16 record, and any switch flip or
launch claim remains out of scope. Next action: owner completes doc 16,
then the named applier executes doc 14 §§1–6 with doc 15 as the evidence
battery.
