# Kick Capabilities — Sponsor Sentinel

> **Source:** Kick Dev Docs — https://docs.kick.com/, https://docs.kick.com/apis/livestreams.md, https://docs.kick.com/apis/channels.md, https://docs.kick.com/apis/users.md, https://docs.kick.com/events/introduction.md, https://docs.kick.com/getting-started/kick-apps-setup.md. Revalidated **2026-09-30** — sitemap still no `videos` endpoint, VOD **NOT_SUPPORTED**. Public API is early, check https://docs.kick.com/changelog.md.

---

## 1. Authentication — public (MVP app token) vs user token (future)

### App Setup (required for both)

- Enable 2FA, go to `Account Settings → Developer` https://kick.com/settings/developer, Create App → generates `ClientID`, `ClientSecret`, `redirectURL` — https://docs.kick.com/getting-started/kick-apps-setup.md. Must use OAuth 2.1 Code Grant with PKCE.
- **OAuth 2.1** — `GET https://id.kick.com/oauth/authorize` → code → `POST https://id.kick.com/oauth/token` with `client_id`, `client_secret`, `code`, `grant_type=authorization_code`, `code_verifier` per https://docs.kick.com/getting-started/generating-tokens-oauth2-flow.md.
- **App Access Token (MVP public reads):** `client_credentials` to `https://id.kick.com/oauth/token` per OpenAPI `securitySchemes: AppAccessToken: clientCredentials: tokenUrl: https://id.kick.com/oauth/token` in https://docs.kick.com/apis/livestreams.md (`security: [UserAccessToken, AppAccessToken]`). For public `Get Livestreams` / `Get Channels` / `Get Users` / `Get Categories`, app token suffices (no user consent) but scopes `channel:read`/`user:read` still needed and app must be approved per https://docs.kick.com/getting-started/scopes.md.

### Scopes (required per endpoint)

- `user:read`, `channel:read`, `channel:write`, `chat:write`, `events:subscribe`, `streamkey:read` etc. — https://docs.kick.com/getting-started/scopes.md. For `Get Livestreams`/`Get Channels`, `channel:read` likely needed — see OpenAPI `security` above (both app and user allowed for livestreams).

**Implication:** Like Twitch app token, Kick supports **App Access Token** for MVP public live reads (no user consent) per security array — but scopes still needed and app must be approved. API key like YouTube not supported; `YOUTUBE_API_KEY` vs `KICK_CLIENT_ID` are different models (MULTI-PLATFORM.md:7). Store server-only.

## 2. Endpoint Catalog (current public, relevance)

| Endpoint | URL | Purpose | Auth | Pagination | Key fields (evidence) | Docs |
|----------|-----|---------|------|------------|----------------------|------|
| **Get Users** | `GET https://api.kick.com/public/v1/users` | Resolve username → id → `ChannelResolver` | App/User | ? | `id` int, `username` | https://docs.kick.com/apis/users.md |
| **Get Channels** | `GET https://api.kick.com/public/v1/channels` / `public/v2/channels` | Channel info (title, category, tags) → `LiveStateProvider` fallback | App/User, `channel:read` | `slug` filter | `id`, `slug`, `broadcaster_user_id`, `channel_description`, `category` (`{id,name}`) → `CanonicalCategory`, `stream_title`, `custom_tags[]` (2025-11-21), `viewer_count` | https://docs.kick.com/apis/channels.md |
| **Get Livestreams** | `GET https://api.kick.com/public/v2/livestreams` / `public/v1/livestreams?broadcaster_user_id=` / `public/v1/users/livestreams?user_id=` | Live snapshot (active only) → `LiveStateProvider` | App/User | `limit` 1-1000 (v2) default 100, `cursor`/`next_cursor` or `broadcaster_user_id` up to 50/100 | `id` uuid, `title`, `category` (`{id,name}`), `tags[]`, `custom_tags[]` → `CanonicalTag` `kick`/`kick_custom`, `started_at`, `viewer_count`, `broadcaster_user {id,username}`, `channel {slug}` | https://docs.kick.com/apis/livestreams.md |
| **Get Categories** | `GET https://api.kick.com/public/v1/categories/:id` | Resolve category → `CanonicalCategory` | App/User | — | `id`, `name`, `thumbnail`, `tags`, `viewer_count` (2025-11-25) | https://docs.kick.com/apis/categories.md |
| **Public Key** | `GET https://api.kick.com/public/v1/public-key` | For webhook RSA verification via `EventVerifier` | — | — | `publicKey` PEM | https://docs.kick.com/apis/public-key.md |

**Not clearly documented (as of 2026-09-30):** `Get Videos` / VOD/replay, `Get Channel VODs`, `duration`, `published_at`, `description` full — not in public OpenAPI index `https://docs.kick.com/sitemap.md`. Sitemap lists `Livestreams` but not `Videos`. **VOD archive NOT_SUPPORTED** — revalidated; do NOT assume `https://docs.kick.com/llms-full.txt` has it — mark `NOT_SUPPORTED` for evaluator and reject capability validation.

**Timestamps:** `started_at` string per OpenAPI — assume RFC3339; `custom_tags` added 2025-11-21.

**Tags:** `tags[]` + `custom_tags[]` → `CanonicalTag[]` with `source` `kick`/`kick_custom` (mixed freeform). See `MULTI-PLATFORM.md:4`.

## 3. VOD / Archive Behavior — confirmed NOT_SUPPORTED

- **Current public API:** No documented `GET /videos` for VOD — livestreams are `Get Livestreams` (active only). Archives may be via `channel` `stream_title` but not VOD metadata. **Conclusion:** Kick **VOD existence, duration, description, published timestamp** are **NOT_SUPPORTED** until documented — see `MULTI-PLATFORM.md:1/13`. `VideoEvidenceProvider.listVideos` returns `[]` → evaluator yields `NOT_SUPPORTED`.
- **Check:** `https://docs.kick.com/sitemap.md` lists `Livestreams` but not `Videos`; `https://docs.kick.com/apis/channels.md` shows `stream_title` but not `duration`. Assume not observable for MVP.

## 4. Events — separated pipeline (01B hardening)

- **Webhooks:** Supported per `https://docs.kick.com/events/webhook-security.md` and `https://docs.kick.com/events/subscribe-to-events.md`. Payloads at `https://docs.kick.com/events/event-types.md`. Events include `livestream.metadata` (2025-05-05), `chat.message`, `moderation.banned`, etc.
- **Headers (EventVerifier):** `Kick-Event-Message-Id` (ULID, idempotent key), `Kick-Event-Subscription-Id` (ULID), `Kick-Event-Signature` (base64 RSA), `Kick-Event-Message-Timestamp` RFC3339, `Kick-Event-Type`, `Kick-Event-Version`.
- **Verification:** `GET /public/v1/public-key` JWKS or static PEM `MIIBIjAN...` per `webhook-security.md`. Signature = `messageId.timestamp.body` concatenated with `.` then RSA `sha256` signed with Kick Private Key; verify `base64Decode(Signature)` with `rsa.VerifyPKCS1v15(pub, SHA256, hash(dots))`. Guard `Timestamp` <10m, dedupe `Message-Id` via `webhook_events(provider_event_id unique)` like Twitch.
- **Separated:** `EventVerifier` (RSA + 10m), `EventParser` (JSON), `EventNormalizer` (→ `CanonicalLiveStream`), `EventIngestor` (evaluate→persist), `SubscriptionManager` (subscribe/renew) — not `EventProvider.subscribe` in scan loop. See `MULTI-PLATFORM.md:6.2`.
- **Relevance:** `livestream.metadata` webhook could replace polling for title/category changes — but Cron reconciler still authoritative. Disabling: Kick unsubscribes webhook after 1 day continual failure — `SubscriptionManager.renewIfNeeded` handles.

## 5. Limitations for Sentinel

- **VOD not documented:** Cannot prove `minimum_duration` (needs VOD `duration`), `required_vod_exists`, `required_description_contains` (needs VOD description) — all `NOT_SUPPORTED` for Kick in MVP — capability validation rejects at creation.
- **Tags:** `tags[]` + `custom_tags[]` → `CanonicalTag` mixed freeform; semantics unclear, treat as freeform lower-exact, not curated.
- **App approval:** Requires Kick App with 2FA + PKCE — not just API key like YouTube.

## 6. Rate / Quota — ProviderBudget unknown

- **Not documented** in public sitemap; assume token-bucket similar to Twitch, but no `Ratelimit-*` headers documented. Treat as **unknown** `ProviderBudget` — generic 429 backoff with jitter, respect `Retry-After` if present.

## 7. Checklist

- [ ] Did I verify `https://docs.kick.com/sitemap.md` for endpoint existence (no `videos` → mark NOT_SUPPORTED)?
- [ ] Did I use `AppAccessToken` with `channel:read` scope per OpenAPI security, and store server-only?
- [ ] Did I handle `custom_tags` vs `tags` → `CanonicalTag` `kick_custom` vs `kick` and `CanonicalCategory`?
- [ ] Did I separate event pipeline (Verifier/Parser/Normalizer/Ingestor/SubscriptionManager) vs scan loop?
- [ ] Did I implement `VideoEvidenceProvider.listVideos` → empty + `NOT_SUPPORTED` for Kick and reject capability validation?
