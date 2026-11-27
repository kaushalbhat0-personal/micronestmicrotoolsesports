# 08 — Acceptance Criteria

## M2B.3A (this milestone)

| # | Criterion | Result |
|---|---|---|
| A1 | Existing bucket configuration and policies inspected (migration + live) | **Met** |
| A2 | Current Storage authorization described accurately | **Met** (`01`) |
| A3 | Owner-only upload/read/delete verified or marked unverified | **Met** — INSERT/SELECT/DELETE verified; UPDATE absent verified |
| A4 | Evidence lifecycle and failure cases documented | **Met** (`02`) |
| A5 | Maximum two-image policy defined | **Met** |
| A6 | Upload validation designed beyond client MIME | **Met** (`04`) |
| A7 | Signed URL access designed safely | **Met** (`03`) |
| A8 | Metadata binds evidence to submitted BGMI ID state | **Met** (`claimed_game_user_id`, `05`) |
| A9 | Threat model covers IDOR and cross-account access | **Met** (`06` T1–T4, T3, T15) |
| A10 | M2B.3B/3C implementation plan sequenced | **Met** (`07`) |
| A11 | No application, migration, Storage policy, or production changes | **Met** |

## M2B.3B / 3C (future gates — not claimed now)

- Server rejects 3rd evidence image.
- Server rejects MIME/magic mismatch and bombs.
- Other user’s JWT cannot read evidence or cases.
- Team owner cannot read member evidence.
- Pending case stores immutable `claimed_game_user_id`.
- Owner can withdraw; status visible without reviewer internals.
- Signed URLs short-lived; not logged in full.
- No service-role in client.
- Public player projection still 12 fields.
- Approve/reject still absent until M2B.4.
