# 07 — Implementation Plan (M2B.3B / M2B.3C)

**Status:** Proposed sequence. M2B.3A makes **no** code or config changes.

## Milestone split

| Milestone | Focus |
|---|---|
| **M2B.3B** | Schema + RLS + Storage path conventions + server upload/submit/withdraw + validation/sanitize + tests |
| **M2B.3C** | Player UI (status, picker max 2, confirm, withdraw) + signed URL preview for owner + rate limits + a11y |

M2B.4 (later): reviewer queue, approve/reject, badge, admin audit writes.

## Essential v1 vs later

| Essential (3B/3C) | Later enhancement |
|---|---|
| Reuse private bucket; images-only app validation | Tighten bucket MIME (drop PDF) |
| Path `{uid}/bgmi-ownership/{case}/{evidence}.ext` | Orphan sweeper cron |
| Cases + evidence tables + RLS | Encrypted forensic original retention |
| Magic + decode + re-encode | Advanced AV scanning |
| Max 2 server-side; one active pending | Soft pixel ML checks |
| Owner signed/preview + status | Reviewer UI |
| Rate limits | Automatic withdraw on ID change |
| Compensation on failed submit | Derivatives CDN |

## Sequenced steps

### A. Storage configuration

1. Confirm live bucket still matches audit (no silent drift).
2. **Decide** PDF keep-at-bucket vs migration tighten (Open).
3. No new bucket unless audit regresses.
4. Document: no UPDATE policy → replace via new keys.

### B. Migration (3B only; requires explicit owner authorize to apply)

1. Create `player_bgmi_ownership_cases` + `player_bgmi_ownership_evidence`.
2. Enums/CHECKs for status and evidence_count.
3. Partial unique: one active draft/pending per player.
4. RLS: owner + `is_super_admin()` SELECT.
5. Indexes; grants.
6. **Do not** apply without authorization; never LMS.

### C. RLS and Storage policies

1. Keep existing Storage owner INSERT/SELECT/DELETE.
2. Do **not** add broad admin Storage SELECT (prefer service-role mint after authz).
3. Optionally add no-op documentation comment in migration notes.
4. App never relies on client-supplied paths.

### D. Server APIs (3B)

1. `createDraftCase` / or single `submitOwnershipEvidence` transaction style.
2. `uploadEvidenceAction` — validate → sanitize → upload → insert row.
3. `confirmSubmissionAction` — require ID + 1..2 evidence → `pending_review` + snapshot.
4. `withdrawCaseAction`.
5. `replaceEvidenceAction` (policy-dependent).
6. `getMyCaseStatus` — player-safe DTO.
7. `mintEvidenceSignedUrl` — owner only in 3C; admin branch stubbed/forbidden until 4.

### E. Validation / sanitization library

1. Shared module (not avatar copy-paste without hardening).
2. Magic bytes + sharp (or approved) decode/re-encode.
3. Unit tests with fixtures (valid, spoofed, bomb, svg).

### F. Player UI (3C)

1. Surface under settings near BGMI ID.
2. Show private ID; block if missing.
3. File input max 2; previews via mint.
4. Confirm → pending status.
5. Withdraw / resubmit messaging.
6. Mobile-first; WCAG AA; design-system tokens.

### G. Rate limiting

1. Per-user upload + submit counters (DB or KV).
2. Return typed errors.

### H. Automated tests

1. Unit: validators, path builder, state transitions.
2. Integration: RLS owner vs other user; max 2; snapshot immutability.
3. Security: T1–T2, T7–T9 fixtures.

### I. Rollback

1. Feature flag / route hide UI.
2. Migration down only if empty or with explicit data wipe authorize.
3. Storage objects: prefix delete script (manual, authorized).
4. Never reset entire DB.

## Dependencies

- M2B.2 BGMI ID validation (done).
- `is_super_admin()` / `platform_admins` present for later admin SELECT.
- Explicit authorization before `db push` / Storage MIME change.
