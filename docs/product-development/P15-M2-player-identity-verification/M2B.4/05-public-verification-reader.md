# 05 — Public verification reader

## Separate from G1

Frozen projection remains exactly 12 columns (`PUBLIC_PROJECTION_COLUMNS`). No verification fields added to directory/profile RPCs.

## RPC

`get_player_bgmi_ownership_public_status(p_handle text)` → `{ handle, ownership_reviewed, status_label }`

Returns reviewed badge only when:

1. Handle resolves to an active, discoverable, complete player
2. An `approved` case exists
3. Live BGMI `game_user_id` still equals immutable `claimed_game_user_id`

Otherwise `ownership_reviewed = false` / null label (or empty set for invalid/private handles).

## Label

`BGMI ownership evidence reviewed` — truthful; does not claim official BGMI endorsement.

## Exclusions

Never returns BGMI Player ID, evidence metadata, Storage paths, reviewer IDs, internal notes, or pending/rejected/withdrawn as verified.

## UI

Public player page loads this reader separately and passes `ownershipReviewed` into profile sections. Settings player UI shows approved/rejected with player-facing copy only.
