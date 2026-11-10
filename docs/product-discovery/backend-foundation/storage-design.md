# Storage Design **[Proposed]**

## Buckets (reuse live; no changes now)

- `org-logos` (public) → extend convention to organization + team + brand logos: `{entity-type}/{entity-id}/logo.{ext}`.
- Player avatars → new prefix convention under a public bucket (recommend new `avatars` bucket to separate identity media from org media; alternative reuse `finder-avatars` — decision at implementation; either is a new-bucket-or-prefix choice, not a schema change).
- `finder-verification` (private) → verification evidence for game IDs, brand authorization, org claims: `{subject-type}/{subject-id}/{uuid}.{ext}`; reviewer reads via SELECT policy + `is_super_admin()` path (proven).
- News media + tournament artwork → public prefixes with editor-only writes.

## Rules per class

| Class | Visibility | MIME allowlist **[Proposed]** | Max size **[Proposed]** | Replace/delete |
|---|---|---|---|---|
| Avatars | public read | png, jpeg, webp | 512 KB | owner replace; owner delete |
| Team/org/brand logos | public read | png, jpeg, webp, svg | 1 MB | admin-scope replace; keep old until replaced (no orphan fan-out needed — single logo_url) |
| Verification evidence | private | png, jpeg, webp, pdf | 5 MB | owner delete while pending only; immutable after decision |
| News/tournament media | public read | png, jpeg, webp | 2 MB | editor replace/delete with article lifecycle |

## Enforcement (both layers)

- Storage layer: bucket MIME + size limits (live buckets currently have none — set at implementation) + path-helper policies mirroring the `can_manage_*` convention with new helpers per prefix.
- Application layer: re-validate MIME/size/owner before upload; evidence uploads require an open submission; logo uploads require admin-scope role; serve private evidence only via signed URLs to reviewers (never public URLs, never in views).
