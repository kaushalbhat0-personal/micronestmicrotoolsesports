# 04 — Upload Validation and Sanitization

**Status:** Proposed. Current avatar path validates **declared MIME + size only** (no magic bytes) — insufficient for private evidence.

## 1. Principle

Browser `File.type` / client MIME checks are **not** sufficient. All acceptance decisions happen on the server after receiving bytes.

## 2. Control stack (essential v1)

| Control | Rule |
|---|---|
| Auth | Session required; active account guard; owner-only |
| Count | Max **2** evidence images per case (server enforces) |
| Size | ≤ 5 MiB per file (align bucket); reject empty |
| Declared MIME | Allow only `image/jpeg`, `image/png`, `image/webp` |
| Extension | Derived from validated type; ignore client filename for path |
| Magic / signature | Verify SOI/IEND / RIFF+WEBP / PNG signature match declared type |
| Decode | Decode with a bounded image library (e.g. `sharp` or equivalent) |
| Dimensions | Reject if width/height outside bounds (propose 64×64 min, 8192×8192 max) |
| Decompression bomb | Cap pixels (e.g. width×height ≤ 25e6) and decode memory/time |
| Corrupt image | Decode failure → reject; delete partial object |
| Metadata | Strip EXIF/XMP/ICC on re-encode (privacy + stego surface reduction) |
| Filename | Never trust; sanitize to UUID path only; no user-controlled path segments |
| Content-Type spoofing | Magic + decode must agree; mismatch → reject |
| SVG / HTML / polyglots | Reject (not in allowlist; decode as image fails) |
| PDF / executables | Reject for this workflow |
| Rate limit | Per-user upload attempts (e.g. 10 / 15 min) + case creation limits |

## 3. Re-encode before reviewable?

**Recommendation: Yes for v1 (essential).**

| Approach | Pros | Cons |
|---|---|---|
| Store original only | Simple | EXIF leaks; polyglot risk; odd codecs |
| Decode + re-encode, replace | Normalized format; stripped metadata; safer for reviewers | CPU; slight quality loss |
| Original + sanitized derivative | Forensics + safe view | 2× storage; dual authz |

**Proposed v1:** decode → re-encode as JPEG or PNG → upload **sanitized** bytes as the stored object; discard original client bytes after success. Case becomes `pending_review` only after sanitized objects + metadata committed.

If product later needs forensic originals, add optional encrypted cold retention (enhancement) — not required for M2B.3.

## 4. Client-side checks (UX only)

- Accept attribute / MIME hint.
- Size preview.
- Max 2 file picker disable.

Always re-validated server-side.

## 5. Error handling

- Return generic validation errors to client (no stack traces, no storage paths with other uids).
- Log structured: user_id, case_id, reason code, byte length — not file contents.

## 6. Telemetry

- Counters: upload_ok, upload_reject_{reason}, submit_ok, submit_reject_pending_exists.
- No PII in analytics beyond opaque ids.
