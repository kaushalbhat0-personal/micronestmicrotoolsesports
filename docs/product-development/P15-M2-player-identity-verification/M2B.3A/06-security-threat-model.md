# 06 — Security Threat Model

**Scope:** Private BGMI ownership evidence upload + metadata. Reviewer approve/reject is threat-modeled for interfaces only (implementation M2B.4).

## Threat catalog

### T1 — Player A downloads Player B’s screenshot

| | |
|---|---|
| **Capability** | Authenticated user; knows or guesses path / evidence id |
| **Impact** | PII / gameplay identity leak; harassment |
| **Existing** | Storage SELECT RLS: folder[1] = auth.uid(); bucket private; no anon read |
| **Required** | Keep owner-only Storage RLS; metadata RLS owner/admin; signed URLs only after authz; never public URLs |
| **Acceptance** | A’s JWT cannot SELECT B’s object; signed-URL mint for B’s evidence as A returns 403 |

### T2 — Player A uploads into Player B’s object path

| | |
|---|---|
| **Capability** | Authenticated; crafts path `{B_uid}/…` |
| **Impact** | Plant evidence; confuse review; storage abuse |
| **Existing** | INSERT WITH CHECK folder[1] = auth.uid() |
| **Required** | Server builds path from session uid only; ignore client-supplied uid/path |
| **Acceptance** | Insert with foreign uid prefix fails; server action rejects client path override |

### T3 — Team owner accesses member evidence

| | |
|---|---|
| **Capability** | Team owner JWT; knows member uid |
| **Impact** | Cross-role PII access |
| **Existing** | No team-based Storage policy on private-verification |
| **Required** | No membership predicates on evidence tables; roster remains private per product |
| **Acceptance** | Team owner cannot SELECT member case/evidence rows or mint member signed URLs |

### T4 — Guess / alter object identifier

| | |
|---|---|
| **Capability** | Authenticated; enumeration |
| **Impact** | Low if under own folder (orphan); high if authz = “know UUID” |
| **Existing** | UUID paths; RLS on folder uid |
| **Required** | Never treat knowledge of UUID as authz; rate-limit list APIs |
| **Acceptance** | Access checks case.player_id / storage folder, not “id exists” |

### T5 — Public RPC exposes evidence metadata

| | |
|---|---|
| **Capability** | Anon or authenticated calling loose RPC/view |
| **Impact** | Path/PII leak → signed URL targeting |
| **Existing** | No evidence tables yet |
| **Required** | RLS on all new tables; no SECURITY DEFINER leak; freeze public player projection at 12 fields |
| **Acceptance** | Anon/other user cannot read cases; public player API unchanged |

### T6 — Signed URL leaks (logs / history / referrer)

| | |
|---|---|
| **Capability** | Log aggregator reader; shared device history |
| **Impact** | Time-boxed unauthorized view |
| **Existing** | No signed URL helpers yet |
| **Required** | TTL 60–300s; no DB persistence; redact query strings in logs; Prefer `Content-Disposition` inline; avoid long-lived tokens |
| **Acceptance** | Log fixtures contain no `token=` query; expired URL fails |

### T7 — Client bypasses two-image limit

| | |
|---|---|
| **Capability** | Direct Storage API / crafted action |
| **Impact** | Storage cost; review spam |
| **Existing** | Bucket has no per-case count |
| **Required** | Server enforces ≤2 evidence rows; reject extra uploads; optional DB CHECK/trigger |
| **Acceptance** | Third upload rejected even if UI removed |

### T8 — Executable or malformed content

| | |
|---|---|
| **Capability** | Upload arbitrary bytes with spoofed MIME |
| **Impact** | Malware hosting; reviewer workstation risk |
| **Existing** | Bucket MIME allowlist includes images (+ PDF); no magic checks in app |
| **Required** | Magic + decode + re-encode; reject non-images; strip metadata |
| **Acceptance** | Polyglot/exe/svg/html rejected; stored object decodes as image |

### T9 — MIME spoofing

| | |
|---|---|
| **Capability** | `Content-Type: image/png` with non-PNG body |
| **Impact** | Bypass naive filters |
| **Existing** | Avatar path trusts declared MIME (known gap) |
| **Required** | Signature must match; decode must succeed |
| **Acceptance** | Mismatched magic rejected |

### T10 — Oversized images / decompression bombs

| | |
|---|---|
| **Capability** | Small file, huge dimensions |
| **Impact** | DoS on decode / review pipeline |
| **Existing** | 5 MiB byte cap only |
| **Required** | Pixel cap + decode limits; timeout |
| **Acceptance** | Bomb fixtures rejected without OOM |

### T11 — Repeated upload abuse

| | |
|---|---|
| **Capability** | Scripted uploads |
| **Impact** | Cost / noise |
| **Existing** | None app-specific |
| **Required** | Per-uid rate limits; one active case |
| **Acceptance** | Excess attempts return 429 / typed error |

### T12 — Upload OK, DB transaction fails

| | |
|---|---|
| **Capability** | Crash / constraint mid-flow |
| **Impact** | Orphan private objects; inconsistent state |
| **Existing** | N/A |
| **Required** | Ordered workflow + compensation delete; orphan sweeper (enhancement) |
| **Acceptance** | Failed submit leaves no `pending_review` without rows; orphans not listed as evidence |

### T13 — BGMI ID changes during pending review

| | |
|---|---|
| **Capability** | Owner edits `game_user_id` |
| **Impact** | Wrong identity approved if reviewer uses live ID |
| **Existing** | M2B.2 allows edit |
| **Required** | Immutable `claimed_game_user_id`; UI mismatch warning; M2B.4 reviews snapshot |
| **Acceptance** | After ID change, case snapshot unchanged; admin view shows snapshot |

### T14 — Evidence replaced after submission

| | |
|---|---|
| **Capability** | Owner deletes/replaces while pending |
| **Impact** | Bait-and-switch on reviewer |
| **Existing** | Owner DELETE allowed on own folder |
| **Required** | Policy: freeze objects on pending **or** allow replace with `updated_at` + audit + reviewer refresh; document choice (**Open**) |
| **Acceptance** | Tests match chosen policy |

### T15 — Unauthorized reviewer access

| | |
|---|---|
| **Capability** | Client sets `role=admin` / calls admin routes |
| **Impact** | Mass evidence access |
| **Existing** | `platform_admins` / `is_super_admin()` in DB; app `requireSuperAdmin` incomplete |
| **Required** | Server-only checks; no client role; M2B.4 mint after `is_super_admin()` |
| **Acceptance** | Non-admin mint/list returns 403 |

### T16 — Service-role credential exposure

| | |
|---|---|
| **Capability** | XSS / bundle inspection / leaked env |
| **Impact** | Full Storage + DB bypass |
| **Existing** | Service role server env pattern |
| **Required** | Never `NEXT_PUBLIC_` service role; owner ops via user JWT; minimize service role to signed-URL mint |
| **Acceptance** | Client bundle grep clean; code review checklist |

## Summary

Highest residual risks before 3B: **no magic-byte validation**, **owner DELETE while pending (bait-and-switch)**, **missing metadata RLS**, **incomplete admin gate wiring**. Existing Storage owner-folder RLS is a strong baseline against T1/T2 if path construction stays server-controlled.
