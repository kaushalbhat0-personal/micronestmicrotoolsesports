# 03 — Implementation notes

C1A delivered the registry helper + `search_player_directory` gate in
`20261128000006_fragix_c1a_registry_ownership_eligibility.sql`. See `04-c1a-registry-eligibility.md`.

Original sketch retained below for history.

## A. Registry ownership helper (prefer SQL function reuse)

Add a narrow `SECURITY DEFINER` helper, e.g. `player_bgmi_ownership_registry_eligible(uuid)`, mirroring the validity logic in `get_player_bgmi_ownership_public_status` (approved case + live `game_user_id` = `claimed_game_user_id`).

Use it **only** in `search_player_directory` `WHERE` clause.

Do **not** add columns to the frozen 12-field return shape.

Avoid clearing `is_discoverable` in triggers.

## B. Leave `get_player_by_handle` ungated by ownership

Preserves AC2 (shareable public URL for opted-in complete unverified players) while AC3 hides them from registry browse/search.

## C. Share card badge (optional display, not a gate)

- Keep download always available when the public page can render.
- If valid ownership status: set eyebrow/disclaimer to truthful reviewed label.
- If not: keep non-reviewed wording; never fake a badge.

Pass status from the existing separate reader into `buildPlayerShareSpec` — do not read private tables from the client.

## D. Copy updates (no schema)

- Discoverability settings: registry requires ownership review; card/URL sharing does not; consent remains independent.
- Campaign / hero: two-benefit messaging from C1 README.
- Remove overbroad “nothing is verified” / “verification required to share card” implications.

## E. Tests to add when implementing

1. Unverified + discoverable + complete → PNG path OK; `search_player_directory` excludes; `get_player_by_handle` returns.
2. Approved + match + discoverable + complete → appears in search; badge true.
3. Approve then change BGMI ID → search excludes; badge false; consent row still opted-in.
4. Projection still length 12; no `game_user_id` in share payload.

## F. Out of scope

- New tools, Discord, analytics SDKs, brand rename (FRAGIX surface can ship in parallel but is separate from this registry gate).
- Broad migrations beyond replace-function / tiny helper.
- Weakening RLS or exposing evidence.
