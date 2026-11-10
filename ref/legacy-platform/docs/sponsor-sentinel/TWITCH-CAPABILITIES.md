# Twitch Capabilities — Sponsor Sentinel

> **Source:** Official Twitch Developer Docs — https://dev.twitch.tv/docs/api/, https://dev.twitch.tv/docs/api/reference/, https://dev.twitch.tv/docs/eventsub/, https://dev.twitch.tv/docs/authentication/. Revalidated **2026-09-30**. Verify before implementing; Helix is source of truth.

---

## 1. Authentication

### App Access Token (MVP)

- **Flow:** Client Credentials Grant — `POST https://id.twitch.tv/oauth2/token` with `client_id`, `client_secret`, `grant_type=client_credentials` → `{ access_token, expires_in, token_type:"bearer" }` — https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow
- **Usage:** `Authorization: Bearer <token>` + `Client-Id: <id>` on Helix. No user consent. Suitable for public data.
- **Lifecycle:** Expires (`expires_in` ~3600s), cache and refresh. Never log secret/token. See `src/server/integrations/twitch/client.ts:22` and `.agents/skills/twitch/SKILL.md`.
- **EventSub webhook requires app token** even if user token exists — per https://dev.twitch.tv/docs/authentication/.

### User Access Token (not MVP-needed)

- Required only for scopes (e.g., `channel:read:ads`, `user:read:email`) — https://dev.twitch.tv/docs/authentication/#user-access-tokens. MVP public endpoints (Get Users/Streams/Videos/Channel Info/Tags) accept **app tokens** per Reference auth column — https://dev.twitch.tv/docs/api/reference/. Do not add user-token flows speculatively.

---

## 2. Endpoint Catalog (relevant to Sentinel)

| Endpoint | URL | Purpose | Auth | Pagination | Key response fields (evidence) | Docs |
|----------|-----|---------|------|------------|-------------------------------|------|
| **Get Users** | `GET https://api.twitch.tv/helix/users?login=&id=` | Resolve Twitch login → `id` (required for all else) → `ChannelResolver` | App | `first` not needed (1-100 ids) | `data[].id`, `login`, `display_name`, `profile_image_url` | https://dev.twitch.tv/docs/api/reference/#get-users |
| **Get Streams** | `GET https://api.twitch.tv/helix/streams?user_id=&user_login=&game_id=` | Live snapshot → `LiveStateProvider` | App | `first` 1-100 default 20, `after` cursor — https://dev.twitch.tv/docs/api/guide/#pagination | `id`, `user_id`, `user_login`, `title`, `game_name`/`game_id` → `CanonicalCategory`, `tags[]` → `CanonicalTag` curated, `started_at` RFC3339, `viewer_count`, `type` ("live" if live) | https://dev.twitch.tv/docs/api/reference/#get-streams |
| **Get Channel Information** | `GET https://api.twitch.tv/helix/channels?broadcaster_id=` | Channel metadata (live or offline) → `LiveStateProvider` fallback | App | Batched `broadcaster_id` repeated | `broadcaster_id`, `broadcaster_name`, `title`, `game_name`/`game_id`, `tags` | https://dev.twitch.tv/docs/api/reference/#get-channel-information |
| **Get Videos** | `GET https://api.twitch.tv/helix/videos?id=&user_id=&game_id` | VOD metadata (post-stream) → `VideoEvidenceProvider` | App | `first` 1-100 default 20, `after` | `id`, `user_id`, `title`, `description`, `duration` (`"1h2m3s"`), `created_at`, `published_at`, `thumbnail_url`, `url`, `viewable` (`public`), `view_count`, `type` (`archive`) | https://dev.twitch.tv/docs/api/reference/#get-videos https://dev.twitch.tv/docs/api/videos/ |
| **Get Stream Tags** | `GET https://api.twitch.tv/helix/streams/tags?broadcaster_id=` | Tags on channel/stream (curated) → `TagProvider` `source:twitch_curated` | App | per broadcaster | `tag_id`[] | https://dev.twitch.tv/docs/api/reference/#get-stream-tags |
| **Get All Stream Tags** | `GET https://api.twitch.tv/helix/tags/streams?tag_id=` | Resolve `tag_id` → name for `CanonicalTag.label` | App | `first` 20-100 | `tag_id`, `localization_names`, `is_auto` | https://dev.twitch.tv/docs/api/reference/#get-all-stream-tags |
| **Get Games** | `GET https://api.twitch.tv/helix/games?id=&name=` | Resolve `game_name` → `game_id` → `CanonicalCategory` (mapper internal, generic uses `id` only) | App | — | `id`, `name`, `box_art_url` | https://dev.twitch.tv/docs/api/reference/#get-games |
| **Create EventSub Subscription** | `POST https://api.twitch.tv/helix/eventsub/subscriptions` | Subscribe webhook/websocket — via `SubscriptionManager` (not scan loop) | **App only for webhook** | — | `id`, `status`, `condition {broadcaster_user_id}`, `transport {callback,secret}` | https://dev.twitch.tv/docs/api/reference/#create-eventsub-subscription |
| **Get EventSub Subscriptions** | `GET .../eventsub/subscriptions` | List subscriptions | App | — | `data[]` | https://dev.twitch.tv/docs/api/reference/#get-eventsub-subscriptions |

**Rate-limit headers every response:** `Ratelimit-Limit` (800 default), `Ratelimit-Remaining`, `Ratelimit-Reset` Unix epoch — https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits. 429 → wait until `Reset`, cost 1 unless doc says otherwise. Batch `user_id` repeated param, not CSV — https://dev.twitch.tv/docs/api/guide/#query-parameters. `ProviderBudget` abstraction, no hard-coded branching.

**Timestamps:** Helix RFC3339 `YYYY-MM-DDTHH:MM:SSZ`; EventSub nanoseconds `...000000000Z` — https://dev.twitch.tv/docs/api/guide/#timestamps.

---

## 3. VOD Availability Behavior

- **Appearance:** VOD `Get Videos` appears after `stream.offline`, not instantly — typically 1–10 min, up to hours if processing. `type=archive`, `viewable=public` when available. See https://dev.twitch.tv/docs/api/videos/ (“Videos are created from past broadcasts”).
- **Deletion:** Broadcaster can delete VOD (`Delete Videos`) or VOD expires; `Get Videos?id=` then 0 results or 404. `viewable` may change.
- **Polling needed:** Cron reconciler required; do not assume VOD present at `stream.offline` timestamp → `PENDING` until `viewable` check passes.

---

## 4. EventSub (webhook) Relevant Types — separated pipeline (01B)

- **Supported for Sentinel:** `stream.online`, `stream.offline`, `channel.update` (title/category change) — https://dev.twitch.tv/docs/eventsub/eventsub-reference/. All transports (webhook/WebSocket/conduit).
- **Webhook verification (EventVerifier):** `POST` to `callback` with `hub.challenge` echo (10s), headers `Twitch-Eventsub-Message-Id`, `Message-Timestamp`, `Message-Signature: sha256=<hmac(secret, id+timestamp+body)>` — https://dev.twitch.tv/docs/eventsub/handling-webhook-events/. Guard duplicate: `message_id` same on retry — store `webhook_events(provider_event_id unique)` `supabase/migrations/20250930000001_initial_schema.sql:197`. Guard replay: `timestamp` not older than 10m per https://dev.twitch.tv/docs/eventsub/#handling-duplicate-events.
- **Separated:** `EventVerifier` (HMAC + 10m), `EventParser` (JSON envelope), `EventNormalizer` (→ `CanonicalLiveStream` via `Get Channel Information` enrichment if needed), `EventIngestor` (evaluate→persist), `SubscriptionManager` (create/list/renew) — not `EventProvider.subscribe` in scanner. See `MULTI-PLATFORM.md:6.2`.
- **Limitations:** Requires public HTTPS `callback` + `secret`, app token, subscription per `broadcaster_id`. Missed events if callback down — need Cron backfill. Duplicates possible (at-least-once) — idempotency required.

---

## 5. Evidence Capability Matrix

| Sponsor requirement | Twitch source | Observable? | Canonical field | Confidence | Notes + Docs |
|---------------------|---------------|-------------|----------------|------------|--------------|
| **Required title phrase** | `Get Streams.title` or `Get Channel Information.title` (live) + `Get Videos.title` (VOD) | **Yes** | `CanonicalLiveStream.title` / `CanonicalVideo.title` | **High** | Helix `title` live + VOD. MVP. |
| **Required hashtag in title** | Same `title` | **Yes** | `title` contains `#hashtag` normalized | **High** | Substring after lower/trim/collapse. |
| **Required Twitch tag** | `Get Stream Tags` / `Get Channel Information.tags` | **Yes** | `CanonicalTag[]` `source:twitch_curated` `id=tag_id` | **High** | Curated IDs via `Get All Stream Tags`. Not freeform hashtag — distinguish. |
| **Required category** | `Get Streams.game_name` → `Get Games` → `CanonicalCategory` / `Get Channel Information` | **Yes** | `CanonicalCategory {id,name,platform:twitch}` | **High** | Resolve `name`→`id` inside mapper; generic uses `id`. |
| **Stream occurred in window** | `Get Streams.started_at` + `Get Videos.created_at`/`published_at` | **Yes** | `started_at` RFC3339 vs campaign window | **High** | See guide Timestamps. |
| **Minimum duration** | `Get Videos.duration` (`"2h34m12s"` → seconds) | **Yes (VOD only)** | `CanonicalVideo.duration_seconds` | **Medium** | Parse Twitch duration; live `started_at` not duration until VOD. |
| **Required phrase in VOD description** | `Get Videos.description` | **Yes** | `CanonicalVideo.description` | **Medium** | May be empty if broadcaster doesn't set. |
| **Live stream detected** | `Get Streams` + `stream.online` EventSub | **Yes** | `CanonicalLiveStream.is_live` | **High** | `Get Streams?user_id=` presence; EventSub hint. |
| **Spoken sponsor mention** | *No Helix field* | **NOT MVP-OBSERVABLE** | — | **None** | Would need ASR. Mark NOT MVP. |
| **On-screen logo / overlay** | *No Helix field* | **NOT MVP-OBSERVABLE** | — | **None** | No video bytes; need CV. |
| **Chat hashtag** | *Not in Helix core* | **NOT MVP-OBSERVABLE** | — | **None** | Separate Chat API. Exclude. |
| **VOD existence** | `Get Videos?id=` / `Get Videos?user_id=` | **Yes** | `viewable=public` + `CanonicalVideo.url` | **High** | |

**Conclusion matrix:** Title/hashtag/`CanonicalTag` curated/category/timing/live/VOD/description are **MVP-observable** via `Get Channel Information`/`Get Streams`/`Get Videos`/`Get Stream Tags` with App Token + `ProviderBudget` 800/min. Spoken/overlay are **NOT MVP-OBSERVABLE**.

---

## 6. Rate-Limit Implications per Requirement — ProviderBudget (01B)

- **Title/hashtag/tags/category/live:** `Get Streams` or `Get Channel Information` per broadcaster per poll — 1 point each. For 30 channels polling 15m: 30*4/hour = 120/hour = 2/min <<800. Burst via `first=100` batched `user_id` repeated.
- **VOD duration/description:** `Get Videos?user_id=` per channel — 1 point each, can paginate `first=20`. Post-stream only, not every poll.
- **Overall MVP:** 1000 orgs × 5 channels = 5000 checks per 15m = ~333/min <800 — within $0 bucket. First scaling constraint for Twitch alone is **800/min** — but YouTube general quota 10k is binding earlier at cross-platform scale (see `MULTI-PLATFORM.md:12`).

---

## 7. Limitations & Gotchas — 01B hardened

- **Tags vs hashtags:** Twitch stream tags (`Get Stream Tags`) curated IDs (e.g., `English`) not `#hashtag` in title. Deliverable must use `required_twitch_tag` → `CanonicalTag` `twitch_curated`, not `required_hashtag`.
- **Category generic:** Do NOT expose `game_name` in generic `CategoryProvider`/`DeliverableRule` — use `categoryId` → `CanonicalCategory`. `game_name`→`id` resolution stays inside mapper.
- **Title change mid-stream:** `channel.update` fires, but `Get Channel Information.title` may lag; prefer `Get Streams.title` for live.
- **VOD delay/deletion:** Do not mark `FAIL` if VOD not yet available — `PENDING` until `viewable` check passes or window closes → `NOT_VERIFIABLE`.
- **EventSub pipeline:** Do NOT put `subscribe` in scan loop; use `EventVerifier`/`Parser`/`Normalizer`/`Ingestor`/`SubscriptionManager` per `MULTI-PLATFORM.md:6.2`.
- **Pagination:** Always handle `pagination.cursor` per https://dev.twitch.tv/docs/api/guide/#pagination; dedupe by `id`.
- **Verification:** Every field claim links to `https://dev.twitch.tv/docs/api/reference/#<endpoint>` or guide. Re-verify before implementing; Twitch may deprecate tags.

---

## 8. Verification Checklist

- [ ] Did I cite `https://dev.twitch.tv/docs/authentication/` for app vs user token + webhook app-token requirement?
- [ ] Did I use `Authorization: Bearer` + `Client-Id` per https://dev.twitch.tv/docs/authentication/#passing-the-access-token-to-the-api ?
- [ ] Did I implement `ProviderBudget` for `Ratelimit-Remaining`/`Reset` on 429, not hard-coded business logic?
- [ ] Did I use cursor pagination per https://dev.twitch.tv/docs/api/guide/#pagination ?
- [ ] Did I verify `stream.online`/`channel.update` in https://dev.twitch.tv/docs/eventsub/eventsub-reference/ and separate event pipeline?
- [ ] Did I use `CanonicalCategory`/`CanonicalTag` (no `game_name` leakage) and `NOT_SUPPORTED` for non-Twitch?
