---
name: kick
description: "Use for Kick Public API in Sponsor Sentinel — OAuth PKCE app setup, Get Livestreams/Channels/Categories, tags (CanonicalTag mixed), webhook RSA verification, and VOD NOT_SUPPORTED. Revalidated 2026-09-30; sitemap has no Videos endpoint."
---

# Kick — Public API (Project-Bounded)

**When to use:** Any change to `src/server/integrations/kick/` or evaluating Kick observability. **Revalidated 2026-09-30**.

**When not to use:** Twitch/YouTube-only changes.

**Installed context (05C real):** Real client `src/server/integrations/kick/client.ts:1` (`https://api.kick.com`, `Bearer app token` via `https://id.kick.com/oauth/token` `client_credentials`, cached 60s buffer) + `auth.ts`. Real provider `src/server/integrations/kick/provider.ts:1` (`ChannelResolver` `GET /public/v1/channels?slug`, `LiveStateProvider` `GET /public/v1/users/livestreams?user_id`, `CategoryProvider` `GET /public/v1/categories/:id` cached, `TagProvider` `kick/kick_custom`, `VideoEvidenceProvider` returns `[]` → `NOT_SUPPORTED`). App requires 2FA + `kick.com/settings/developer` per https://docs.kick.com/getting-started/kick-apps-setup.md. No VOD in `https://docs.kick.com/sitemap.md` — VOD is **NOT_SUPPORTED**. Registry `src/server/integrations/registry.ts:46` (`kick` real when `KICK_CLIENT_ID/SECRET` present else mock).

## Authentication — public (MVP app token) vs user token (future)

- **Setup:** 2FA → `Account Settings → Developer` → Create App (ClientID/Secret/redirectURL) → OAuth 2.1 PKCE `GET https://id.kick.com/oauth/authorize` → `POST https://id.kick.com/oauth/token` (`client_id`, `client_secret`, `code`, `grant_type=authorization_code`, `code_verifier`) per `https://docs.kick.com/getting-started/generating-tokens-oauth2-flow.md`.
- **App Token (MVP public reads):** `client_credentials` to `https://id.kick.com/oauth/token` per OpenAPI `AppAccessToken: clientCredentials: tokenUrl` in `https://docs.kick.com/apis/livestreams.md` (`security: [UserAccessToken, AppAccessToken]`). For public `Get Livestreams` / `Get Channels` / `Get Users` / `Get Categories`, app token suffices (no user consent) but scopes `channel:read`/`user:read` still required and app must be approved — `https://docs.kick.com/getting-started/scopes.md`.
- **User Token (future):** PKCE required for `channel:write`/`events:subscribe`/`chat:write` etc.

## Endpoints Relevant to Sentinel (revalidated)

| Endpoint | URL | Purpose | Auth | Fields | Docs |
|----------|-----|---------|------|--------|------|
| **Get Channels** | `GET https://api.kick.com/public/v1/channels` / `v2` | Channel info | App/User `channel:read` | `id`, `slug`, `broadcaster_user_id`, `stream_title`, `category {id,name}`, `custom_tags[]` (2025-11-21), `channel_description` | https://docs.kick.com/apis/channels.md |
| **Get Livestreams** | `GET https://api.kick.com/public/v2/livestreams` + `GET /public/v1/users/livestreams?user_id=` | Live snapshot (active only) | App/User | `id` uuid, `title`, `category {id,name}`, `tags[]`, `custom_tags[]`, `started_at`, `viewer_count`, `broadcaster_user {id,username}`, `channel {slug}` — paginated `limit` 1-1000 + `cursor` → `next_cursor` | https://docs.kick.com/apis/livestreams.md |
| **Get Users** | `GET .../public/v1/users` | Resolve username → id | App/User `user:read` | `id` int, `username` | https://docs.kick.com/apis/users.md |
| **Get Categories** | `GET .../public/v1/categories/:id` | Resolve category → `CanonicalCategory` | App/User | `id,name,thumbnail` + `tags,viewer_count` (2025-11-25) | https://docs.kick.com/apis/categories.md |
| **Public Key** | `GET .../public/v1/public-key` | Webhook RSA verification | — | `publicKey` PEM | https://docs.kick.com/apis/public-key.md |

**Pagination:** `limit` 1-1000 (v2) default 100, `cursor` → `next_cursor`. **No `Get Videos` / VOD in sitemap** `https://docs.kick.com/sitemap.md` — sitemap lists Livestreams but not Videos. **VOD NOT_SUPPORTED** → `required_vod_exists`/`minimum_duration`/`required_description_contains` yield `NOT_SUPPORTED` on Kick — see `MULTI-PLATFORM.md:1/13`.

**Timestamps:** `started_at` string (assume RFC3339); `custom_tags` added 2025-11-21.

**Tags:** `tags[]` + `custom_tags[]` → `CanonicalTag[]` with `source: kick|kick_custom` (mixed freeform). See `MULTI-PLATFORM.md:4`.

## Events — separated pipeline (01B hardening)

- Webhooks per `https://docs.kick.com/events/webhook-security.md` + `https://docs.kick.com/events/subscribe-to-events.md`, payloads `https://docs.kick.com/events/event-types.md` (`livestream.metadata` 2025-05-05, `chat.message`, etc.).
- **Headers:** `Kick-Event-Message-Id` (ULID, idempotent key), `Kick-Event-Subscription-Id` (ULID), `Kick-Event-Signature` (base64 RSA), `Kick-Event-Message-Timestamp` RFC3339, `Kick-Event-Type`, `Kick-Event-Version`.
- **Verification:** `Kick-Event-Signature` RSA `sha256(messageId.timestamp.body)` signed with Kick Private Key; verify via PEM `-----BEGIN PUBLIC KEY-----...` from `GET /public/v1/public-key` (or static documented key) — `base64Decode(signature)` + `rsa.VerifyPKCS1v15(pub, SHA256, hash(bodyWithDots))`. Guard `Timestamp` <10m, dedupe `Message-Id` via `webhook_events(provider_event_id unique)` like Twitch.
- **Separated:** `EventVerifier` (RSA + timestamp), `EventParser` (JSON), `EventNormalizer` (→ `CanonicalLiveStream`), `EventIngestor` (evaluate→persist), `SubscriptionManager` (subscribe/renew) — not in scan loop.

## Limitations

- **VOD:** No public `GET /videos` documented — mark `NOT_SUPPORTED`, do NOT hallucinate.
- **Rate:** Not documented — `ProviderBudget` unknown → generic 429 backoff with `Retry-After` + jitter.
- **App approval:** 2FA + PKCE, not just API key.

## Version Check

Verify via `https://docs.kick.com/sitemap.md` + `https://docs.kick.com/llms-full.txt` before implementing; changelog `https://docs.kick.com/changelog.md` changes often (2025-11-21 `custom_tags`). Revalidated 2026-09-30.
