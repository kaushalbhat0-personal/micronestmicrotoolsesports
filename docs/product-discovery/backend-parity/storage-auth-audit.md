# Storage & Auth Audit (metadata only)

## Storage

Buckets (live-confirmed): `org-logos` (public), `finder-avatars` (public), `finder-verification` (private). No size/MIME limits set (both NULL — app-layer validation only). Object count is nonzero but small; individual objects were **not** listed or opened (customer-file enumeration prohibited).

Policies (12, `storage.objects`, verified definitions): per-bucket public-read SELECT on the two public buckets; owner-folder INSERT/UPDATE/DELETE via `can_manage_*` path helpers; `finder-verification` SELECT adds `OR is_super_admin()` reviewer path. Pattern is sound and directly reusable for brand/org media (new prefixes under existing or new buckets — later decision).

**Gap:** no MIME/size enforcement at policy level; new media flows should add bucket limits when defined (P1, not blocker).

## Auth

- Live user/session/identity enumeration **not performed** (prohibited). `auth` schema table list confirmed standard GoTrue set (users, sessions, identities, MFA, OAuth, SAML/SSO tables present as platform defaults) — presence only, no settings inferred.
- Effective auth posture (from repo `config.toml` + live schema refs): email signup, GoTrue-managed `auth.users` → `profiles` trigger provisioning (live `profiles_id_fkey` confirms the linkage pattern).
- `get_publishable_keys` was deliberately **not** called (returns key material; prohibited by credential rules).
- Settings that cannot be safely inspected (confirmations, SMTP, OAuth providers, MFA, hooks, JWT expiry live): marked **UNKNOWN** — confirm via dashboard read-only review during implementation planning (feeds D-15).
- No auth changes made or recommended in this phase.
