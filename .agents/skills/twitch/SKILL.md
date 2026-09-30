---
name: twitch
description: "Use when working with Twitch Helix API or EventSub for Sponsor Sentinel — App Access Tokens (webhook requires app token), Get Users/Streams/Videos/Channel Info, tags (CanonicalTag curated), pagination, rate limits (800/min), and separated event pipeline. Verify current docs."
---

# Twitch — Helix + EventSub (Project-Bounded)

**When to use:** Any change to `src/server/integrations/twitch/`, sponsor channel/VOD discovery, or when evaluating what Twitch can/cannot prove. **Revalidated 2026-09-30**.

**When not to use:** Pure UI text/style without Twitch, or generic HTTP fetches not to `api.twitch.tv` / `id.twitch.tv`.

**Installed context (05A real):** App Access Tokens via `POST https://id.twitch.tv/oauth2/token` (`client_id` + `client_secret` + `grant_type=client_credentials`) — see `src/server/integrations/twitch/client.ts:22` + `auth.ts` token cache with 60s buffer and single-flight refresh. No user-token scopes needed for MVP public data. Budget is **token bucket 800/min** per client_id. Real adapter `src/server/integrations/twitch/provider.ts` implements `ChannelResolver`/`LiveStateProvider`/`VideoEvidenceProvider`/`CategoryProvider`/`TagProvider` via `TwitchClient`; provider selection via `src/server/integrations/registry.ts` (`twitch` real when `TWITCH_CLIENT_ID`+`SECRET` present else mock; youtube/kick remain mock).

## Authentication

- **App Access Token** (server-to-server, no user consent): `POST https://id.twitch.tv/oauth2/token` — https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
  - Request: `client_id=<id>&client_secret=<secret>&grant_type=client_credentials`
  - Response: `{ access_token, expires_in, token_type: "bearer" }`
  - Use: `Authorization: Bearer <token>` + `Client-Id: <id>` on Helix. Cache `expires_in` and refresh. Never log secret/token.
  - **EventSub webhook requires app token** — webhook `POST /helix/eventsub/subscriptions` fails with user token per https://dev.twitch.tv/docs/authentication/.
- **User Access Token** not needed for MVP public endpoints (Get Users/Streams/Videos/Channel Info/Tags accept app tokens per https://dev.twitch.tv/docs/api/reference/). Only add when needing `channel:read:ads`-like scopes.

## Helix Endpoints Relevant to Sponsor Sentinel

All `https://api.twitch.tv/helix/...` require `Authorization` + `Client-Id` per https://dev.twitch.tv/docs/authentication/. Check Reference auth column.

| Endpoint | Purpose for Sentinel | Auth | Key fields (for evidence) |
|----------|----------------------|------|---------------------------|
| `GET /helix/users?login=` / `?id=` | Resolve login → `id` (needed for all else) | App | `id`, `login`, `display_name` |
| `GET /helix/streams?user_id=` | Live stream snapshot (title, tags, game) | App | `title`, `game_name`/`game_id` → `CanonicalCategory`, `tags[]` → `CanonicalTag` curated, `started_at`, `viewer_count`, `type` (live) |
| `GET /helix/channels?broadcaster_id=` | Channel info (live or offline) | App | `title`, `game_name`, `tags`, `broadcaster_language` |
| `GET /helix/videos?id=&user_id=&game_id` | VOD metadata (post-stream) | App | `title`, `description`, `duration` (`"2h34m12s"`), `created_at`, `published_at`, `viewable`, `thumbnail_url`, `url`, `type` |
| `GET /helix/tags/streams?broadcaster_id=` / `GET /helix/streams/tags` | Stream tags (Twitch-defined curated) | App | `tag_id` — map via `Get All Stream Tags` → `CanonicalTag{source:twitch_curated}` |
| `GET /helix/games?id=&name=` | Resolve `game_name` → `game_id` → `CanonicalCategory` (mapper internal, generic uses `id` only) | App | `id`, `name` |

**Not MVP-observable via Helix:** Spoken mentions, on-screen logos/overlays, chat content, raw video/audio. Helix exposes **metadata only**. See `docs/sponsor-sentinel/TWITCH-CAPABILITIES.md`.

## Pagination & Lists

- Cursor pagination `first` (min/max/default per endpoint, Get Streams max 100, Get Videos max 100) + `after`/`before` cursors per https://dev.twitch.tv/docs/api/guide/#pagination. Response `pagination.cursor` or `{}` if done. Lists dynamic — dedupe by `id`.
- Batch: `user_id` repeated `?user_id=123&user_id=456` (not CSV) per https://dev.twitch.tv/docs/api/guide/#query-parameters.

## Rate Limits — ProviderBudget abstraction (do not hard-code in domain)

- Token bucket 800/min per `client_id` per https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits, cost 1 per request unless doc says otherwise. Headers: `Ratelimit-Limit`, `Ratelimit-Remaining`, `Ratelimit-Reset` Unix epoch. 429 → wait until `Reset`, do not mark deliverable `FAIL`.
- Implement `ProviderBudget` per `MULTI-PLATFORM.md:8` — scanner respects `Remaining/Reset`, batch `user_id`s, `first` max, concurrency 5.

## EventSub — separated pipeline (01B hardening: no EventProvider.subscribe in scanner)

- Supports `stream.online`, `stream.offline`, `channel.update` per https://dev.twitch.tv/docs/eventsub/ — webhook/WebSocket/conduit per https://dev.twitch.tv/docs/eventsub/.
- Webhook requires `callback` verification + signature `Twitch-Eventsub-Message-*` headers (`Message-Id`, `Message-Timestamp`, `Message-Signature = sha256(secret + id + timestamp + body)`) per https://dev.twitch.tv/docs/eventsub/handling-webhook-events/.
- **Separated responsibilities:** `EventVerifier` (HMAC + timestamp <10m), `EventParser` (JSON envelope), `EventNormalizer` (→ `CanonicalLiveStream`), `EventIngestor` (evaluate→persist), `SubscriptionManager` (create/list/renew subscriptions) — not `EventProvider` in scan loop. See `MULTI-PLATFORM.md:6.2`.
- **Idempotency:** `message_id` same on retry — store `webhook_events(provider_event_id unique)` + `scans.idempotency_key`. Guard replay: `message_timestamp` not older than 10m.

## Error Handling (05A)

- 401 → clear cache and refresh app token once, then fail as `auth` (`TwitchApiError.kind="auth"`). 429 → `rate_limited` with `Ratelimit-Reset` ISO, budget `BUDGET_EXCEEDED` not `FAIL`. 5xx → `server` no auto-retry loop. 404 → `not_found` → `NOT_VERIFIABLE`/`null` for channel/stream. HTTP errors never map to compliance `FAIL`.
- Never log `Authorization` / token; error messages truncate body to 500 chars and hide token (`client.ts:sanitizeErrorMessage`). Validate Helix response shape before mapper; malformed → `malformed`.
- Adapter `src/server/integrations/twitch/` normalizes to `Canonical*` (`mappers.ts`) — never leak Helix shape to `features/sponsor-sentinel/services/`. Use `src/server/integrations/registry.ts` so scanner stays provider-neutral.

## Version Check

Verify before implementing: `https://dev.twitch.tv/docs/api/reference#get-videos` etc., `https://dev.twitch.tv/docs/eventsub/eventsub-reference/`. Do not rely on memory for field names (VOD `description` vs `title`). Revalidated 2026-09-30.
