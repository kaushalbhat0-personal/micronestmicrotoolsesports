# 04 — Submission and Withdrawal Lifecycle

## States

`draft` → `pending_review` → (`id_mismatch` | `withdrawn`)

Client cannot set `pending_review` via table UPDATE (no UPDATE policy + guard trigger). Submit only via `submit_player_bgmi_ownership_case`.

## Submit

Requires active owner, draft case, 1–2 evidence rows, live `player_game_profiles.game_user_id` for `bgmi`. Snapshots into immutable `claimed_game_user_id`.

## ID mismatch

On `game_user_id` change for `game_key=bgmi`, pending cases become `id_mismatch` + `identity_mismatch=true`. Snapshot is **not** rewritten. Case cannot be approved (M2B.4 must refuse). New submission requires new case; old evidence not reusable after withdraw.

## Withdraw

`withdrawBgmiOwnershipCase`:

1. Rate limit
2. RPC marks `withdrawn`, clears claim, deletes evidence metadata, returns Storage paths
3. App deletes Storage objects
4. Reports `storageDeleteFailures` if remove fails (does not claim full deletion falsely)
5. Empty RPC result ⇒ already withdrawn (idempotent)

Minimal audit retained on case row: id, player_id, status, timestamps (no claim, no evidence paths).
