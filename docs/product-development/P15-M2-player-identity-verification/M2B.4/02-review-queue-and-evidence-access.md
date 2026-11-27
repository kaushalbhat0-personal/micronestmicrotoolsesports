# 02 — Review queue and evidence access

## Queue

- RPC: `list_pending_bgmi_ownership_cases(p_limit)` — super-admin only; default/max bound 1–100.
- Fields: case id, handle, display name, IGN, claimed BGMI Player ID (reviewer-only), submitted_at, evidence_count, status, identity_mismatch.
- UI sorts pending first (RPC already filters `pending_review`, oldest first).
- Empty state when none pending. No bulk approve.

## Evidence inspection

1. `requireSuperAdmin(client)`
2. Load evidence row by `case_id` + `evidence_id`; deny if missing / wrong case / wrong bucket
3. Deny if `evidence.player_id === reviewer.userId` (self)
4. Mint signed URL with `createAdminClient()` → Storage `createSignedUrl(path, 60)`
5. Return URL to authorized reviewer UI only; never persist; never log query strings

Storage bucket `private-verification` remains private. No broad reviewer Storage SELECT policy was added.

## Routes

| Path | Access |
| --- | --- |
| `/workspace/moderation/bgmi-ownership` | Super-admin; `robots: noindex` |
| Server actions in `actions.ts` | Session client only; no service key in route modules |
