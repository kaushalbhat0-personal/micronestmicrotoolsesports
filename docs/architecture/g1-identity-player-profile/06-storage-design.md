# 06 — Storage Design (G1, uses existing buckets — no new buckets/policies)

Foundation already deployed (verified): `public-avatars` (public, 512 KB, png/jpeg/webp), `public-entity-media` (public, 2 MB, png/jpeg/webp/svg+xml), `private-verification` (private, 5 MB, png/jpeg/webp/pdf); 8 policies (avatar owner CRUD, verification owner CRUD/read, 2× public read, no entity-media authenticated writes).

## 1. Bucket usage

| Need | Bucket | Why |
|---|---|---|
| Player avatar (single current image) | `public-avatars` | Public reads (directory/cards), owner-scoped writes, 512 KB cap fits avatars, no SVG (XSS surface reduction). |
| Team/org/brand logos, news/tournament artwork (future) | `public-entity-media` | NOT used in G1 (no entity domains). Writes remain service-role-only until domain tables land (foundation posture preserved). G1 must not add permissive insert policy. |
| Verification evidence (future workflow) | `private-verification` | NOT used in G1 (no verification workflow). Private, signed-URL-only. G1 performs no evidence uploads. |

No G1 bucket creation. No G1 policy changes.

## 2. Object path conventions

- Avatar: `{auth.uid()}/avatar.{ext}` where `ext ∈ {png,jpg,jpeg,webp}` (lowercased; `jpeg` normalized to `jpg` or kept — app canonicalizes to one; decision D-G1-06 in 10). Single file per user: replacement overwrites the same path (no orphan fan-out). DB `avatar_path` stores this relative path (not full URL); public URL derived as `{SUPABASE_URL}/storage/v1/object/public/public-avatars/{path}`.
- Rationale for `{uid}` first segment: matches deployed policy predicate `(storage.foldername(name))[1] = auth.uid()::text` exactly. Any other prefix breaks authorization. Enforced by Zod + DB CHECK (see 03/05) + policy.
- No user-controlled subpaths. No handle-based paths (handles change; UIDs stable). No listing of others’ prefixes (policy prevents; app never lists bucket).

## 3. Authorization (existing policies, how G1 uses them)

- Upload: owner inserts `{uid}/...` only (`public-avatars owner insert`, `authenticated`, WITH CHECK). App pre-validates MIME/size server-side before upload (defense in depth; bucket enforces too).
- Update/overwrite: owner update (`USING` + `WITH CHECK` same scope). G1 replacement = upload to same path (upsert).
- Delete: owner delete (same scope). Used on avatar removal and profile/account deletion cleanup.
- Read: anyone (`public` role) can read `public-avatars` objects (`public-avatars public read`). No auth needed for directory images (CDN-friendly). Verification bucket has no public read (owner SELECT only; reviewers via signed URLs in future).
- G1 adds no policies. App never uses service-role for avatar reads (public URL) — service-role only for cleanup deletes (owner token suffices, but server cleanup after account delete needs service-role since session may be gone).

## 4. MIME and size rules (application re-validation)

Bucket enforces, app re-validates before upload (never trust client MIME):

- Avatars: `image/png`, `image/jpeg`, `image/webp` only; ≤512 KB (bucket `524288`). App rejects `image/svg+xml` for avatars even though `public-entity-media` allows it — SVG is active content (script/event handlers, external refs) and must not be user-hosted as image in an `<img>`-assumed context across all consumers.
- SVG safety note: `public-entity-media` includes `image/svg+xml` for future org/brand artwork (vector logos). G1 does not upload SVGs. When entity domains land, SVG handling requires sanitization (strip scripts/events, external refs) + `Content-Security-Policy` + serving with `Content-Disposition` review; avatars must remain raster-only permanently.
- PDF/images in `private-verification`: untouched in G1.

## 5. Lifecycle and cleanup

| Event | Storage action | Actor |
|---|---|---|
| Avatar upload/replace | Upsert `{uid}/avatar.{ext}`; if extension changes, delete old object then insert new (avoid two live files) | Owner (authenticated, policy-scoped) |
| Avatar removal (keep profile) | Delete `{uid}/avatar.*` (list own prefix, delete matches); set `avatar_path = NULL` in same server flow | Owner |
| Profile deletion (account kept) | Delete all `{uid}/*` under `public-avatars` (should be ≤1 file); null references | Owner/server |
| Account deletion | Delete `{uid}/*` in `public-avatars` (service-role cleanup, session-independent) | Server (service-role) |
| Verification evidence | No G1 lifecycle (no workflow) | — |

Failure handling: DB and storage are not transactional together. Order: storage delete first, then DB update; on storage failure, abort DB change and surface retryable error (no dangling `avatar_path` pointing at missing object, and no orphan object without reference beyond one retry window). Cleanup jobs (future) may sweep orphan `{uid}` prefixes with no referencing profile — not built in G1.
