# 01 — Schema and Migrations

## Migration

| Item | Value |
|---|---|
| File | `supabase/migrations/20261128000002_p15_m2b3b_bgmi_ownership_evidence.sql` |
| Project ref | `knniommcyyhbyiwljisk` (verified linked before push) |
| Applied | **Yes** via `npx supabase db push --linked` |
| LMS | Not accessed |

## Tables (verified remote)

### `player_bgmi_ownership_cases`

- `id`, `player_id` → `app_users`
- `status`: `draft` \| `pending_review` \| `withdrawn` \| `id_mismatch`
- `claimed_game_user_id` (nullable until submit; immutable once set)
- `identity_mismatch`, `evidence_count` (0–2)
- `submitted_at`, `withdrawn_at`, timestamps
- Partial unique: one active (`draft`/`pending_review`) per player

### `player_bgmi_ownership_evidence`

- Metadata only (no image bytes)
- FK to case; `player_id` must match case
- Unique `(case_id, sort_order)` with sort_order ∈ {1,2}
- Unique `storage_path`
- MIME allowlist jpeg/png/webp; size ≤ 5 MiB; dimensions 64–8192

### `player_bgmi_ownership_rate_events`

- Durable rate-limit log; no authenticated table grants (RPC only)

## RPCs

- `assert_bgmi_ownership_rate_limit(event, limit, window)`
- `submit_player_bgmi_ownership_case(case_id)` — snapshots live BGMI ID
- `withdraw_player_bgmi_ownership_case(case_id)` — returns paths to delete

## Triggers

- Case status / claim immutability guards (GUC-gated RPCs)
- Evidence count + draft-only attach + immutable rows
- `player_game_profiles.game_user_id` change → pending cases → `id_mismatch`
