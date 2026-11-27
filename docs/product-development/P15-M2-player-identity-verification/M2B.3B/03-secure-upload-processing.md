# 03 — Secure Upload Processing

## Module

`src/features/player-profile/server/bgmi-ownership/`

- `sanitize-image.ts` — magic bytes + sharp decode/re-encode + strip metadata
- `paths.ts` — server-built object paths
- `service.ts` — create / upload / submit / withdraw / status / signed URL
- `rate-limit.ts` — RPC-backed limits

## Dependency

`sharp@0.35.5` added as a **direct** dependency (already present transitively via Next). Required for reliable decode/re-encode; without it M2B.3B would be blocked.

## Pipeline

1. Session via `ensureAppUser` / `getUser`
2. Case ownership + `draft` status
3. Live BGMI ID must exist
4. Max 2 evidence (app + DB)
5. Original ≤ 5 MiB
6. Magic allowlist (reject PDF/SVG/GIF)
7. sharp: `animated:false`, `limitInputPixels`, dimension bounds
8. Re-encode JPEG/PNG/WebP (EXIF stripped)
9. Path from server UUIDs only
10. Storage upload then metadata insert
11. On metadata failure → Storage remove (orphan cleanup)

Client MIME / filename / path are never trusted. Errors never echo BGMI IDs or file bytes.
