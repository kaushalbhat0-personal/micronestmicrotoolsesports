# 06 — Future Verification Compatibility

No verification status or badge is implemented in M2B.2.

## Intended invalidation contract (for M2B.3 / M2B.4)

When ownership cases exist:

1. **Detect change:** any successful owner write that changes `player_game_profiles.game_user_id` from value A → B or A → `NULL` (including clear).
2. **Effect on approvals:** any `approved` case for that `(subject_user_id, game_key)` whose `claimed_game_user_id` ≠ current stored ID must transition to `withdrawn` (or equivalent invalidated state) with audit reason `bgmi_id_changed`.
3. **Pending cases:** mark `withdrawn` or require resubmit with new evidence matching the new ID.
4. **Public flag:** separate narrowly scoped reader must return false after invalidation (no stale badge).
5. **Implementation options (future):**
   - SECURITY DEFINER trigger on `player_game_profiles` after update of `game_user_id`, or
   - Explicit invalidate call inside the owner update RPC/path once cases exist.

## Why not implemented now

- No `player_bgmi_ownership_cases` table yet (M2B.3).
- Inventing a fake verified flag would violate locked product rules.

## Compatibility of current storage

Storing the live ID in `game_user_id` and snapshotting `claimed_game_user_id` on submit (M2B.3 design) enables exact comparison for stale-approval detection.
