# 08 — Implementation Plan (M2B Work Packages)

Architecture only — **do not implement in M2A**. Order respects dependencies.

## Dependency sequence

```
M2B.1 Profile editing & completeness
   └─► M2B.2 Private BGMI ID storage/access hardening + UI
         └─► M2B.3 Private evidence upload/retrieval
               └─► M2B.4 Reviewer auth + manual review + public flag
                     ├─► M2B.6 Share Kit / visual integration (badge eyebrow)
                     └─► M2B.5 Discord (optional, deferred — after 1–4)
```

Discoverability completeness gate can ship at end of **M2B.1** (RPC) once required fields are editable.

---

## P15-M2B.1 — Profile editing & completeness

**Goal:** Owner can edit public profile + game fields; completeness UI accurate; discoverability hard-gated when enabling.

| Area | Expected changes |
|---|---|
| Files | `src/app/settings/profile/**`, `src/app/onboarding/profile/**`, `src/features/player-profile/server/{player-profile,game-profile,completeness,consent}.ts`, schemas, access-policy |
| DB | Possibly extend `set_player_discoverability` guard (migration) |
| RLS | Prefer no broaden; column grants remain owner-scoped |
| Server | Update profile / update game profile actions |
| UI | Edit forms: display name, bio, country, IGN, role, region, modes, availability; wire avatar upload |
| Tests | Unit completeness; integration update + discoverability reject when incomplete; Playwright settings happy path |
| Security acceptance | No public projection widen; no `game_user_id` in public responses |
| Rollback | Feature-flag UI; revert RPC guard migration |

---

## P15-M2B.2 — Private BGMI ID storage & access

**Goal:** Collect/edit `game_user_id`; keep owner-private; ID-change invalidates verification later (hook stub OK).

| Area | Expected changes |
|---|---|
| Files | Game profile schemas/UI; settings section “BGMI Player ID (private)” |
| DB | Reuse column; optional trigger stub documenting invalidate-on-change (full logic in M2B.4) |
| RLS | Confirm SELECT owner-only (already) |
| Server | Update path includes `game_user_id`; never returned from directory readers |
| Tests | Integration: other user cannot read; public RPC key-set unchanged |
| Security acceptance | T1/T3 tests green |
| Rollback | Hide field; stop collecting |

---

## P15-M2B.3 — Private evidence upload & retrieval

**Goal:** Submit/replace/withdraw 1–2 screenshots into `private-verification` + metadata tables.

| Area | Expected changes |
|---|---|
| Files | New `src/features/player-profile/verification/**` (or `ownership/`); settings evidence UI; server actions for signed URLs |
| DB | `player_bgmi_ownership_cases`, `player_bgmi_ownership_evidence` + RLS |
| Storage | Keep private bucket; app MIME sniff; optional policy tighten |
| Server | submit/withdraw; owner signed URL; **no** reviewer yet (or read-only queue stub) |
| UI | Upload, preview own evidence, withdraw |
| Tests | Storage IDOR; size/MIME reject; max 2 objects |
| Security acceptance | T2/T7/T8/T12/T13 |
| Rollback | Drop tables (after data notice); leave bucket |

---

## P15-M2B.4 — Reviewer authorization & manual review

**Goal:** Super-admin review queue; approve/reject; audit; public boolean reader; ID-change revoke.

| Area | Expected changes |
|---|---|
| Files | `src/server/admin/*` requireSuperAdmin + audit writer; `src/app/workspace/moderation/player-ownership/**` |
| DB | Review RPCs; public flag reader; invalidate trigger; audit events |
| RLS | Reviewer via DEFINER only |
| Server | approve/reject actions; signed URL for reviewers |
| UI | Queue list, evidence preview, reason field, truthful copy |
| Tests | Non-admin denied; self-approve denied; audit appended; badge clears on withdraw/ID change |
| Security acceptance | T4/T5/T6/T15/T16/T17 |
| Rollback | Disable route + revoke execute on review RPC |

---

## P15-M2B.5 — Optional Discord connection (deferred)

**Goal:** Only if owner approves after 1–4. Otherwise skip.

| Area | Expected changes |
|---|---|
| Files | Settings connect UI; `player_discord_links`; OAuth callback route |
| DB | Link table; **no** public projection changes |
| Auth config | Production Discord provider enable — **explicit owner ops** |
| Tests | CSRF; token not public; disconnect; no completeness coupling |
| Security acceptance | T10/T11 |
| Rollback | Disable provider; drop link table |

**Default plan:** skip this package in the first M2 implementation train.

---

## P15-M2B.6 — Share Kit & visual integration

**Goal:** Optional “BGMI ownership evidence reviewed” eyebrow; ensure evidence never in PNG inputs.

| Area | Expected changes |
|---|---|
| Files | `player-card-model.ts`, `player-share-card.tsx`, profile sections copy, unit/E2E |
| DB | Consume public boolean reader only |
| Tests | Forbidden keys; badge absent when withdrawn |
| Security acceptance | T9/T17 + Share Kit privacy doc |
| Rollback | Remove eyebrow branch |

Can start UI stubs after M2B.4 public reader exists; parallelize copy with M2B.4 late.

---

## Cross-package non-goals

- No team roster identity cards
- No official BGMI/Krafton claims
- No LMS project access
- No Docker
- No widening frozen 12-field RPCs without explicit freeze-break decision
