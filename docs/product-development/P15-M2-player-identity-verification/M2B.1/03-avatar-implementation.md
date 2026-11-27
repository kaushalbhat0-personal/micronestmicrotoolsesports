# 03 — Avatar Implementation

## Status: Implemented (wired existing safe path)

No new bucket. No Storage policy redesign. Does **not** use `private-verification`.

## Existing infrastructure (reused)

| Item | Source |
|---|---|
| Bucket `public-avatars` | `20261110000002_storage_foundation.sql` |
| MIME png/jpeg/webp, 512 KB | Same + `schemas/avatar.ts` |
| Path `{uid}/avatar.{ext}` | Owner folder RLS |
| Server ops | `uploadAvatar` / `removeAvatar` |

## UI wiring

- `AvatarSection` on `/settings/profile`
- `uploadAvatarAction` / `removeAvatarAction` validate MIME/size then call server ops
- Preview via `storage.from(public-avatars).getPublicUrl(path)`
- Missing avatar: dashed placeholder fallback

## Security preserved

- Session-derived path only  
- No cross-account writes  
- No SVG / executable types  
- No weakening of storage policies  
