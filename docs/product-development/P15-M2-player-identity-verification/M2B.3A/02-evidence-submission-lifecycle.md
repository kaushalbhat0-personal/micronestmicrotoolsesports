# 02 — Evidence Submission Lifecycle

**Status:** Proposed (product + security design). No implementation in M2B.3A.

## 1. Player lifecycle (happy path)

1. Player opens BGMI verification (settings / identity surface).
2. UI loads **their** saved BGMI Player ID from owner-private `game_user_id` (never from public projection).
3. Player selects screenshot #1 (required).
4. Server validates upload (see `04-upload-validation-and-sanitization.md`).
5. Optional screenshot #2 (hard max **2** total).
6. Player reviews files + displayed BGMI ID + confirmation copy.
7. Player confirms → submission enters **`pending_review`**.
8. Player sees status: draft / pending / withdrawn / rejected / (future: approved) — **without** reviewer-only notes, internal scores, or other players’ data.

## 2. State machines (two layers)

### 2.1 Evidence object state (per file)

| State | Meaning |
|---|---|
| `uploading` | Client in flight (client-only; not persisted) |
| `stored` | Object exists in `private-verification`; metadata row present; not yet part of a submitted case **or** attached to draft |
| `attached` | Linked to a case in `draft` or `pending_review` |
| `superseded` | Replaced; object scheduled for delete |
| `deleted` | Removed from Storage |

Upload success ≠ reviewable. A case becomes reviewable only when evidence is `attached` **and** case transitions to `pending_review` after server validation.

### 2.2 Submission / case state (review)

| State | Player-visible label | Terminal? | Notes |
|---|---|---|---|
| `draft` | Draft / incomplete | No | Optional if multi-step; may collapse into single submit |
| `pending_review` | Pending review | No | M2B.3 endpoint; **no approve/reject yet** |
| `withdrawn` | Withdrawn | Soft terminal | Player cancelled; may allow new case |
| `rejected` | Rejected | Soft terminal | M2B.4 sets this; player may resubmit new case |
| `approved` | Verified | Soft terminal | M2B.4; badge rules later; out of 3A implement |

**Do not** implement approve/reject in M2B.3B/C — only states through `pending_review` + `withdrawn` (+ handling of future `rejected` for resubmit UX stubs).

## 3. Failure and edge cases

### 3.1 No BGMI Player ID saved

- Block submit.
- UI: require saving BGMI ID first (link to M2B.2 section).
- Server: reject if `game_user_id` is null/empty at confirm time.

### 3.2 Invalid or missing evidence

- Zero files → reject.
- >2 files → reject (server count, not UI-only).
- Failed validation (MIME, magic, size, dimensions) → reject upload; no orphan preferred (delete if created).

### 3.3 Upload succeeds, submission creation fails

- Prefer **case-first draft + upload under case id**, or transactional compensation:
  1. Create draft case + snapshot ID.
  2. Upload to path under owner + case id.
  3. Insert evidence rows.
  4. Transition to `pending_review`.
- On step 4 failure after 2–3: mark case `draft` or delete case + Storage objects (best-effort cleanup job).
- Never leave reviewable pending without valid evidence rows.

### 3.4 Submission creation succeeds, upload fails

- Case stays `draft` (or is deleted).
- Player retries upload.
- Do not expose `pending_review` without ≥1 valid evidence object.

### 3.5 Duplicate / existing pending submission

- **Policy (proposed):** at most **one** active case in `{draft, pending_review}` per player.
- New submit while pending → reject with clear error; offer withdraw or replace-evidence path.
- **Open:** whether replace-evidence is allowed while pending without withdraw (recommend: yes, limited, audited).

### 3.6 Rejected → resubmission

- New case row (new id); prior evidence retained per retention policy or deleted after N days (**Open**).
- Snapshot new `claimed_game_user_id` at new submit time.

### 3.7 Player replacing evidence

- While `draft` or (if allowed) `pending_review`: delete old object(s) + insert new; update evidence rows; max still 2.
- No Storage UPDATE policy → new object keys.

### 3.8 Player withdrawing

- `pending_review` → `withdrawn`.
- Evidence: delete immediately **or** retain short TTL for abuse forensics (**Open**; default propose delete-on-withdraw for privacy).

### 3.9 BGMI ID changes while pending

- Case retains **`claimed_game_user_id`** snapshot (immutable).
- Current profile `game_user_id` may diverge.
- Player status UI shows: “Submitted for ID …; your saved ID is now …” if mismatch.
- Auto-action (**proposed**): do **not** auto-approve; optionally auto-withdraw or flag `identity_mismatch` for M2B.4 (**Open**).
- Reviewer must compare screenshot to **snapshot**, not live ID alone.

### 3.10 BGMI ID changes after future approval

- Approval binds to snapshot (+ optional hash).
- Live ID change → badge becomes stale / revoked until re-verify (M2B.4+ policy).
- Do not treat live ID as proof of prior approval.

### 3.11 Account deletion

- Cascade: delete cases, evidence metadata, Storage objects under `{uid}/…`.
- Align with existing auth user deletion / GDPR path (**Open:** confirm cascade hooks).

## 4. What the player may see

Allowed: own BGMI ID, own evidence thumbnails via **short-lived signed URLs** issued after owner authz, case status, timestamps, high-level rejection reason (future).

Forbidden: other players’ evidence, reviewer identity internals, admin notes, platform_admins membership, service URLs with long TTL.

## 5. What M2B.3 does **not** include

- Approve / reject UI or RPCs.
- Public verification badge grant.
- Discord.
- Widening the 12-field public projection.
