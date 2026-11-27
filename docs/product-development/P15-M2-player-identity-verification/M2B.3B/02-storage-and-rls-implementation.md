# 02 — Storage and RLS Implementation

## Bucket

Reuse `private-verification` (`public=false`, 5 MiB). Bucket MIME still includes PDF — **unchanged**. BGMI workflow rejects PDF in app.

## Path

```
{owner_uid}/bgmi-ownership/{case_id}/{evidence_id}.{ext}
```

UUID alone is not authorization. Storage folder[1] must equal `auth.uid()`; bgmi paths also require case status checks.

## Storage policies (live)

| Policy | Behavior |
|---|---|
| `private-verification owner insert` | Own folder; **bgmi-ownership** paths require case `draft` |
| `private-verification owner read` | Own folder (unchanged) |
| `private-verification owner delete own pending` | Own folder; **bgmi-ownership** paths require case `draft` or `withdrawn` |

Pending / `id_mismatch` objects **cannot** be deleted by owner until withdraw flips status.

Non-`bgmi-ownership` paths keep prior folder-only insert/delete (no unrelated consumer break).

## Table RLS

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| cases | owner or `is_super_admin()` | owner draft only | **none** (RPC only) | none |
| evidence | owner or super-admin | owner + draft case | none (immutable) | owner + draft/withdrawn |
| rate_events | none (RPC) | none | none | none |

No team-owner policies. No anon policies. No public URLs.
