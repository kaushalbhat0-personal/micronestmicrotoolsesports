# 03 — Security and Privacy Verification

## Unchanged boundaries (confirmed)

| Boundary | Status |
|---|---|
| Supabase schema / migrations | Not modified |
| RLS / RPC grants | Not modified |
| Authorization helpers | Not modified |
| Auth settings / env vars | Not modified |
| Public player projection columns | Unchanged; share reads subset only |
| Team public privacy (no roster identities) | Preserved |
| Service-role usage | Not introduced on client |
| Tool client-only execution | Preserved (no uploads / no server snapshots) |

## Player card

- Built only from `PublicPlayerCard` + public URL.
- Route still 404s non-discoverable handles before share UI mounts.
- Label: “Discoverable Player” — **not** LFT, **not** verified.
- Forbidden key guard unit-tested (`email`, `game_user_id`, `id`, etc.).

## Team card

- Omits `id` / owner / org fields from share input.
- Recruiting claim only when `recruiting === true`.
- No open-role invention; disclaimer states roster identities unavailable.

## Tool exports

- Local session state only.
- Disclaimers: planning-only / simulation-only / not official results.
- No analytics or telemetry endpoints added.

## Explicitly not added

Server share tokens, stored snapshots, public roster identity endpoints, recruitment tables, tracking pixels.
