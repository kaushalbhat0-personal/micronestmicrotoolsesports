# 03 — Storage and Authorization Design

**Status:** Proposed architecture on top of **verified** current bucket/policies (`01-current-storage-audit.md`).

## 1. Bucket reuse decision

**Reuse `private-verification`.**

| Requirement | Fit |
|---|---|
| Private | Verified `public=false` |
| Size cap | 5 MiB — adequate for phone screenshots; keep |
| MIME | Bucket allows PDF; **app rejects PDF** for player BGMI evidence v1 |
| Owner path RLS | Verified INSERT/SELECT/DELETE |
| Separated from avatars / Share Kit | Verified distinct buckets; process rule |

**Optional later (not blocking 3B):** migration to drop `application/pdf` from bucket allowlist **or** keep PDF for other future verification types under different path prefixes.

## 2. Bucket configuration (v1 target)

| Setting | Value |
|---|---|
| Privacy | Private (unchanged) |
| Max file size | 5 MiB (unchanged) unless product needs larger screenshots |
| Allowed MIME (app) | `image/jpeg`, `image/png`, `image/webp` only |
| SVG | **Reject** (XSS / scriptable) |
| Animated GIF / APNG | **Reject** (or strip to single frame if ever allowed — default reject) |
| PDF | **Reject** for this workflow |
| Original retention | Retain originals for review period; no public derivatives required for v1 |
| Sanitized derivatives | **Recommended for v1 reviewability:** server decode → re-encode JPEG/PNG strip metadata → store as review object **or** replace original. See `04`. |

## 3. Object path scheme

```
{owner_uid}/bgmi-ownership/{case_id}/{evidence_id}.{ext}
```

| Segment | Purpose |
|---|---|
| `owner_uid` | Satisfies existing folder RLS (`folder[1] = auth.uid()`) |
| `bgmi-ownership` | Namespace vs future other verification types in same bucket |
| `case_id` | UUID of submission; groups ≤2 files; safe delete of whole case |
| `evidence_id` | UUID per file; non-guessable; replacement = new id |
| `ext` | Canonical `jpg` / `png` / `webp` from validated type |

**Why UUID alone is not authorization:** Storage RLS keys off **folder[1] = session uid**. An attacker who learns `{victim_uid}/…/{uuid}.png` still cannot SELECT/INSERT/DELETE unless their JWT uid matches `victim_uid` (or they hold service role). Guessing only the evidence UUID under the attacker’s own folder creates an orphan, not cross-account access. Authorization must **also** be enforced in metadata RLS and in any signed-URL minting API.

## 4. Authorization matrix

| Actor | Upload | Read object | Delete | Mint signed URL | Decide review |
|---|---|---|---|---|---|
| Owner (authenticated, active account) | Own path only | Own path / own case | Own draft/pending per policy | Own evidence only | No |
| Other player | No | No | No | No | No |
| Team owner (of member) | No | No | No | No | No |
| Anon / public | No | No | No | No | No |
| Reviewer (`platform_admins` / `is_super_admin`) | No client upload into others’ paths | **Not via client Storage RLS** | No | **Server action** after `is_super_admin()` (M2B.4) | M2B.4 |
| Browser | Never holds service-role key | — | — | — | — |

**Client-controlled reviewer role:** Forbidden. Role checks only server-side against `platform_admins` / `is_super_admin()`.

## 5. Signed URLs

| Rule | Design |
|---|---|
| Necessary? | **Yes** for private bucket display (owner preview + future reviewer) |
| Issuer | Server-only (Server Action / Route Handler) using user-scoped client **or** service role **after** authz |
| Before signing | Verify session + (owner of case **or** super-admin) + evidence row exists + case not purged |
| Expiry | Short: **60–300 seconds** proposed |
| Public URLs | Never (`getPublicUrl` forbidden for this bucket) |
| Logging | Log case_id / evidence_id / actor only — **never** full signed URL query strings |
| Persistence | Do not store signed URLs in DB |

Owner may alternatively use Storage SELECT via authenticated client for own folder without signed URLs; signed URLs still needed for admin UI that cannot rely on owner JWT. Prefer **one** server mint path for both to avoid divergent auth bugs.

## 6. Safe replacement and deletion

- No UPDATE policy → always new `evidence_id`.
- Replace: insert new → update metadata → delete old object (order matters for crash safety).
- Withdraw / account delete: delete objects under case prefix; best-effort; reconcile orphans via cron (enhancement).

## 7. Service role

- Allowed only in trusted server modules after explicit authz.
- Never import into Client Components or expose via `NEXT_PUBLIC_*`.
- Prefer user JWT + RLS for owner operations; service role for reviewer read if Storage RLS remains owner-only (recommended: keep owner-only Storage RLS, use service role solely inside signed-URL mint after `is_super_admin()`).
