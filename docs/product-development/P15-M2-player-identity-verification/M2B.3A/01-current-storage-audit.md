# 01 — Current Storage Audit

**Status:** Verified against migration `supabase/migrations/20261110000002_storage_foundation.sql` and live Esports project `knniommcyyhbyiwljisk` (`npx supabase db query --linked`, 2026-11-28).

## 1. Bucket inventory (relevant)

| Bucket | public | file_size_limit | allowed_mime_types | Source |
|---|---|---|---|---|
| `private-verification` | **false** | **5242880** (5 MiB) | `image/png`, `image/jpeg`, `image/webp`, **`application/pdf`** | Migration + live |
| `public-avatars` | true | 2097152 | png/jpeg/webp | Migration + live (separation confirmed) |
| `team-logos` | true | 2097152 | png/jpeg/webp | Out of scope |
| `match-screenshots` | false | 10485760 | png/jpeg/webp | Out of scope for player BGMI evidence |

**Verified:** Live `storage.buckets` row for `private-verification` matches migration values exactly.

## 2. Object path convention (documented in migration)

Foundation migration documents owner-scoped paths:

```
{auth.uid()}/{uuid}.{ext}
```

Authorization is **not** the UUID. RLS requires `(storage.foldername(name))[1] = auth.uid()::text`. A guessed object UUID under another user’s folder fails SELECT/INSERT/DELETE for that session.

## 3. `storage.objects` RLS — `private-verification`

Live names match migration `20261110000002_storage_foundation.sql`:

| Policy name | cmd | roles | USING / WITH CHECK (essence) | Live? |
|---|---|---|---|---|
| `private-verification owner insert` | INSERT | authenticated | bucket = private-verification ∧ folder[1] = auth.uid() | Yes |
| `private-verification owner read` | SELECT | authenticated | same | Yes |
| `private-verification owner delete own pending` | DELETE | authenticated | same folder check **only** | Yes |
| *(none)* | UPDATE | — | — | **0 UPDATE policies** (live count verified) |

**Note:** Despite the DELETE policy name containing “pending”, the live predicate does **not** gate on submission status — any owner-folder object may be deleted by the owner. Application-layer freeze (or status-aware delete denial) is required for bait-and-switch control (threat T14).

**Verified absences:**

- No `anon` / `public` SELECT on `private-verification`.
- No team-owner or membership-based Storage policy for this bucket.
- No reviewer/admin Storage policy granting direct SELECT on all objects.
- No service-role policy needed in RLS (service role bypasses RLS by design; must never ship to browser).

## 4. Grants / roles

Storage object access for players is mediated by Supabase Storage API under the authenticated JWT. Service-role keys are server-only (env); **verified:** no `SUPABASE_SERVICE_ROLE` / service-role string usage in client bundles under `src/` for Storage helpers related to verification (none exist yet).

## 5. Upload / read / update / delete behavior today

| Operation | Player (authenticated, own folder) | Other player | Anon | Reviewer via Storage RLS |
|---|---|---|---|---|
| Upload (INSERT) | Allowed if path under own uid | Denied by RLS | Denied | No dedicated policy |
| Read (SELECT) | Allowed own folder | Denied | Denied | No dedicated policy |
| Overwrite (UPDATE) | **Denied** (no policy) | Denied | Denied | Denied |
| Delete | Allowed own folder | Denied | Denied | No dedicated policy |

**Implication for M2B.3B:** Replacement must be **delete + insert** (or new object key), not in-place UPDATE. Prefer immutable keys per evidence row + orphan cleanup.

## 6. Signed URL usage

| Area | Finding |
|---|---|
| App code calling `createSignedUrl` / `createSignedUrls` for `private-verification` | **None** (`src/` grep) |
| Public URL pattern for verification | Not used (bucket is private) |
| Avatar helpers | `getPublicUrl` on `public-avatars` only — **must not** be reused for evidence |

## 7. Existing Storage helpers (application)

| Helper | Bucket | Validation | Notes |
|---|---|---|---|
| `src/features/player-profile/server/avatar.ts` | `public-avatars` | Declared MIME allowlist + size; **no magic bytes** (integration test documents this) | Owner path `{uid}/avatar.{ext}`; delete-before-upload pattern |
| Match / team logo helpers | other buckets | Separate | Do not reuse for BGMI evidence |

**Verified:** No player-profile or settings code uploads to `private-verification`.

## 8. Application surface relevant to M2B.3

| Area | State |
|---|---|
| BGMI Player ID UI / action (M2B.2) | Shipped: `BgmiPlayerIdSection`, `updateBgmiPlayerIdAction`, `gameUserIdSchema` / `normalizeGameUserIdInput` |
| Auth / active-account guards | Existing settings/profile patterns; reuse for evidence actions |
| Evidence upload UI / actions | **Absent** |
| Verification case metadata tables | **Absent** (`player_bgmi_ownership_cases` not present live) |
| Admin audit writer / `requireSuperAdmin` | Tables/functions exist in schema lineage; **live app wiring incomplete** for reviewer workflow (M2B.4) |

## 9. Separation from public-avatar

| Concern | Status |
|---|---|
| Distinct buckets | Verified |
| Distinct policies | Verified |
| Evidence never written as avatar | Design rule; no code path today could confuse them if evidence uses private bucket only |
| Share Kit canvases | Client-generated PNGs for sharing — **must never** be stored as verification evidence |

## 10. Gaps vs evidence workflow needs

1. Bucket allows **PDF**; player evidence v1 should reject PDF at application validation (Open: whether to tighten bucket MIME later).
2. No UPDATE → replacement strategy must be explicit.
3. No reviewer Storage SELECT → reviewers must use **server-side signed URLs** (or service-role after authz) in M2B.4 — not client JWT as “reviewer”.
4. No magic-byte / decode checks anywhere for uploads.
5. No rate limiting specific to Storage uploads in app.
6. No submission metadata binding evidence to `game_user_id` snapshot.

## 11. Unverified / out of scope

- Exact Storage CDN cache headers for signed URLs (platform default).
- Historical orphan objects already in `private-verification` (if any) — not queried for privacy.
- LMS project — **not accessed**.
