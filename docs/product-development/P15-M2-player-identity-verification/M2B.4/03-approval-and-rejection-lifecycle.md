# 03 — Approval and rejection lifecycle

## Statuses (after M2B.4)

`draft` → `pending_review` → `approved` | `rejected`  
Also: `withdrawn`, `id_mismatch` (from pending or approved when live BGMI ID diverges from claim).

## Approve gates (RPC)

- Authenticated + `is_super_admin()`
- Not self (`player_id <> auth.uid()`)
- Status exactly `pending_review`
- Not `identity_mismatch`; `claimed_game_user_id` present
- Evidence count 1–2
- Live `player_game_profiles.game_user_id` equals `claimed_game_user_id`
- Row lock `FOR UPDATE`; update only if still `pending_review` (concurrent conflict → exception)
- Insert `player_bgmi_ownership_decisions` then case update + audit in same transaction

## Reject gates

- Same authz / pending / self-ban
- Internal reason 5–500 chars (required)
- Player-facing message 5–280 chars (required; stored on case for player UI)
- Internal reason never returned on public reader

## Client path

No direct client UPDATE of status. Forms post to server actions → `decideBgmiOwnershipCase` → RPC only.
