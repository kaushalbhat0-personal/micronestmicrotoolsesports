# Sponsor Sentinel — Multi-Platform Architecture

> **Authoritative cross-platform doc for SENTINEL-01B (hardened).** Revalidated **2026-09-30** against official docs. Twitch `TWITCH-CAPABILITIES.md`, YouTube `YOUTUBE-CAPABILITIES.md`, Kick `KICK-CAPABILITIES.md` are source-of-truth per platform; this doc is the **decision** layer. Supersedes `SENTINEL-01A` — see §14 Changes from 01A.

---

## 1. Capability Matrix (Twitch vs YouTube vs Kick) — revalidated 2026-09-30

| Capability | Twitch | YouTube | Kick | Common abstraction | Source |
|------------|--------|---------|------|--------------------|--------|
| Channel identity | YES (`id` numeric string) | YES (`UC...`) | YES (`id` int) | `ConnectedChannel.platform + external_channel_id` | Twitch `Get Users` / YouTube `channels.list` / Kick `Get Channels` |
| Channel handle/login | YES (`login`/`display_name`) | YES (`snippet.customUrl` handle) | YES (`slug`/`username`) | `external_handle` | same |
| Live status | YES (`Get Streams` → `type:live` + `Get Channel Information`) | PARTIAL (`snippet.liveBroadcastContent=live` + `liveStreamingDetails.actualStartTime` requires known `videoId`; no `Get Streams` equivalent — discovery via `search.list` or PubSubHubbub) | YES (`Get Livestreams?user_id` active only)` | `CanonicalLiveStream.is_live` | Twitch Ref / YouTube `videos.list` + `snippet.liveBroadcastContent` / Kick `GET /public/v1/users/livestreams` |
| Stream title | YES | YES | YES | `CanonicalLiveStream.title` | |
| Description | PARTIAL (VOD `Get Videos.description` only) | YES (`snippet.description` — live+VOD) | UNKNOWN (no VOD field documented; `channel_description` only in `Get Channels`) | `description: string \| null` | Twitch `Get Videos` / YouTube `videos.list` / Kick sitemap no `videos` |
| Hashtag in title | YES | YES | YES | `required_hashtag` (platform-neutral, normalized) | Same as title |
| Platform tags | YES (curated `tag_id` via `Get Stream Tags` + `Get All Stream Tags`) | FREEFORM (`snippet.tags[]` uploader-set) | FREEFORM (`tags[]` + `custom_tags[]` 2025-11-21) | **Not common** — platform-scoped rules `required_twitch_tag` vs `required_youtube_tags` vs `required_kick_tags` returning `CanonicalTag[]` | Twitch `Get Stream Tags` / YouTube `videos#snippet.tags` / Kick `custom_tags` |
| Category | YES (`game_name`/`game_id` via `Get Games`) | YES (`snippet.categoryId` → `videoCategories.list`) | YES (`category {id,name}`) | `CanonicalCategory {id,name,platform}` — **no `game_name` in generic** | Twitch `Get Games` / YouTube `VideoCategories` / Kick `Get Categories` |
| Stream start time | YES (`started_at` RFC3339) | YES (`liveStreamingDetails.actualStartTime` or `snippet.publishedAt`) | YES (`started_at` string, assume RFC3339) | `started_at: string \| null` | |
| Stream end time | PARTIAL (VOD `published_at` not `ended_at`) | YES (`liveStreamingDetails.actualEndTime`) | UNKNOWN (no VOD) | `ended_at: string \| null` | |
| Duration | YES (VOD `duration` `"2h..."`) | YES (`contentDetails.duration` `PT...`) | UNKNOWN (no VOD documented) | `duration_seconds: number \| null` | |
| VOD/archive exists | YES | YES | **NO / NOT_SUPPORTED** | `required_vod_exists` — **NOT_SUPPORTED** on Kick | Twitch `Get Videos` / YouTube `videos.list` / Kick sitemap no `videos` |
| VOD URL | YES (`url`) | YES (`https://youtube.com/watch?v=...`) | UNKNOWN | `url: string \| null` | |
| Published timestamp | YES (`published_at`/`created_at`) | YES (`snippet.publishedAt`) | UNKNOWN | `published_at: string \| null` | |
| Live event identity | YES (`stream.id`) | PARTIAL (`video id` if live) | YES (`id` uuid) | `CanonicalLiveStream.external_id` | |
| Event / webhook | YES (`stream.online/offline/channel.update` EventSub webhook/WebSocket/conduit — **app token required for webhook**) | PubSubHubbub (WebSub) via `https://pubsubhubbub.appspot.com/subscribe` + `hub.challenge` — `https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...` (Atom, not EventSub) | YES (`livestream.metadata` etc. — RSA `Kick-Event-Signature` + `Kick-Event-Message-Id` ULID) | Separate `EventVerifier`/`EventParser`/`EventNormalizer`/`SubscriptionManager` — not `EventProvider.subscribe` in scanner | Twitch `eventsub-reference` / YouTube `push_notifications` / Kick `webhook-security` |
| Polling support | YES (`Get Streams`/`Get Channel Information`) | YES (`channels.list` + `videos.list` id-based; `search.list` discovery but **100/day cap** — see §8) | YES (`Get Livestreams`, `Get Channels`) | Cron reconciler | |
| Pagination | YES (`after` cursor, `first` 1-100) | YES (`pageToken`, `maxResults` 1-50 for `myRating`/`chart`; `id` mode not paginated) | YES (`cursor`/`next_cursor`, `limit` 1-1000) | Provider-specific | Twitch guide pagination / YouTube `videos/list#pageToken` / Kick `next_cursor` |
| Rate / quota model | **Token bucket 800/min per client_id** (`Ratelimit-Remaining/Reset`) — cost 1 | **Quota buckets**: 10,000 units/day general (cost 1 per `videos.list`/`channels.list`/`liveBroadcasts.list`/`liveStreams.list`/`videoCategories.list`) + **separate 100/day buckets** `search.list` (1 each) & `videos.insert` (1 each). ETag `304` saves. See §8 | **UNKNOWN** (not documented — generic 429 backoff) | `ProviderBudget` abstract (see §8) — **no hard-coded 10_000 in business logic** | Twitch `api/guide/#twitch-rate-limits` / YouTube `getting-started#quota` + `determine_quota_cost` (2026-09-15) / Kick unknown |
| Auth — public (MVP) | App token (`client_credentials` → `id.twitch.tv/oauth2/token`, `Client-Id`+`Bearer`, no user consent) | **API key** (`key=...` server-only, public `channels.list`/`videos.list`) — no OAuth for MVP public title/category/VOD | App token (`client_credentials` → `id.kick.com/oauth/token`, scopes `channel:read`/`user:read`, 2FA + app approval) | Per-provider `AuthRequirement` (see §7) | Twitch `authentication/#app-access-tokens` / YouTube `guides/authentication` / Kick `kick-apps-setup` |
| Auth — private/future | User token (OAuth `authorization_code` + scopes) only when private scopes needed; **webhook EventSub requires app token** | **OAuth 2.0** (`authorization_code` + `refresh_token`, scopes `youtube.readonly` etc., Cloud project + consent screen) required for `liveBroadcasts.list`, `liveStreams.list`, `myRating`, `onBehalfOfContentOwner`, private videos | User token (PKCE `authorization_code` + `code_verifier`, scopes `channel:read` etc.) required for write/private | MVP = public only; private = future | |
| App-level vs user-level | App suffices for MVP `Get Users/Streams/Videos/ChannelInfo/Tags` | API key suffices for public; OAuth only for private/liveBroadcasts | App suffices for public `Get Livestreams/Get Channels` per `security: [UserAccessToken, AppAccessToken]` | — | |
| Free-tier | YES | YES — but **first bottleneck is quota buckets** (not rate) | YES (app free, approval needed) | — | |
| Major limitation | Tags curated not hashtag | Discovery needs `search.list` (100/day cap) or PubSubHubbub; avoid `search` for polling | VOD not documented → duration/VOD/description `NOT_SUPPORTED` | — | |

**Legend:** YES = supported, PARTIAL = limited/semantic differ, FREEFORM = freeform semantics, NO = not, UNKNOWN = not in official sitemap (treat as NOT_SUPPORTED), NOT_SUPPORTED = capability decision.

Revalidation notes (2026-09-30):
- Twitch auth doc `https://dev.twitch.tv/docs/authentication/` still: user vs app tokens, client_credentials for app, EventSub webhook requires app token. Rate limit 800/min confirmed `https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits`. Pagination cursor confirmed.
- YouTube `https://developers.google.com/youtube/v3/getting-started#quota` + `https://developers.google.com/youtube/v3/determine_quota_cost` (2026-09-15): **quota correction** — `search.list` is **1 per call, 100/day separate bucket** (not 100 cost inside 10k). Old doc claim `search.list=100 units` is stale. `videos.list`/`channels.list`/`liveBroadcasts.list`/`liveStreams.list` = 1 unit inside 10k. `videos.insert` = 1 inside 100/day insert bucket. `liveStreamingDetails` + `snippet.liveBroadcastContent` still requires known `videoId`. PubSubHubbub `https://developers.google.com/youtube/v3/guides/push_notifications` still `hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...`, verify `hub.challenge`.
- Kick `https://docs.kick.com/apis/livestreams.md` OpenAPI still `security: [UserAccessToken, AppAccessToken]` for livestreams, pagination `next_cursor`, no `videos` in `https://docs.kick.com/sitemap.md`. Webhook `https://docs.kick.com/events/webhook-security.md` still RSA `Kick-Event-Signature = base64(sha256(messageId.timestamp.body))` + headers `Kick-Event-Message-Id` (ULID), `Kick-Event-Message-Timestamp` RFC3339, `Kick-Event-Signature`, public key `https://api.kick.com/public/v1/public-key`.

---

## 2. Observability Model

**Metadata-observable (Helix/Data API/Kick API):** title, description (Twitch VOD / YouTube snippet, Kick only `channel_description` — treat live description as nullable/unknown), `CanonicalCategory`, `CanonicalTag[]` (semantics differ), hashtag in title, start/end, duration (Twitch/YouTube only), VOD existence/URL (Twitch/YouTube only), channel identity, live state.

**Content-observable (NOT HELIX/API):** Spoken mention, logo on screen, product shown, chat mention, overlay — requires VOD download + ASR/CV/OCR/chat API — **outside MVP**, future feature. Never map technical inability → `FAIL`.

**Principle:** `Technical inability → NOT_SUPPORTED / NOT_VERIFIABLE / PENDING, not FAIL` per `EVIDENCE-MODEL.md`. `NOT_SUPPORTED` (platform never can) vs `NOT_VERIFIABLE` (platform can but this observation cannot) vs `PENDING` (evidence may appear) are distinct.

---

## 3. Platform-Normalized Abstraction — ConnectedChannel (hardened)

**Why `TwitchChannel` → `ConnectedChannel`:** Domain was Twitch-coupled (`twitch_user_id`, `twitch_login`). Multi-platform requires `platform` enum + generic `external_channel_id/handle` + `canonical_url`. Justification: every other entity already had `organization_id` direct; only channel was platform-specific.

**Discovery vs Authorization — two distinct modes (new in 01B):**

- `discovered` = publicly verified via `ChannelResolver` (no user grant). `Get Users` / `channels.list` / `Get Channels` proves existence; sufficient for **all MVP public reads**.
- `authorized` = user-granted OAuth (PKCE/`authorization_code` + scopes) — stored `oauth_authorized_at`, `refresh_token` encrypted, `connection_status` lifecycle. Required only for **private/future** (`liveBroadcasts`, `myRating`, `channel:write`, etc.). **Do not equate `connected` with `authorized`.** MVP creates `discovered` rows; `authorized` is future opt-in.

```ts
enum Platform { TWITCH = "twitch", YOUTUBE = "youtube", KICK = "kick" }

type ConnectionMode = "discovered" | "authorized";
type ConnectionStatus = "connected" | "disconnected" | "expired" | "revoked";
// discovered: status always "connected" unless deleted/404 verified; authorized: tracks token expiry/revocation.

interface ConnectedChannel {
  id: string; // uuid PK
  organization_id: string; // FK, RLS
  platform: Platform;
  external_channel_id: string; // Twitch numeric string | YouTube UC... | Kick int string
  external_handle: string; // login / customUrl / slug — human input
  display_name: string | null;
  canonical_url: string; // https://twitch.tv/<login> | https://youtube.com/channel/UC... | https://kick.com/<slug> — derived
  connection_mode: ConnectionMode; // NEW — clarifies discovered vs authorized
  connection_status: ConnectionStatus;
  authorized_at: string | null; // RFC3339 if authorized, else null
  // scopes_granted: string[] | null; // future, when authorized
  metadata: { category_id?: string; tags?: string[] } | null; // last known, not source of truth
  created_at: string;
  updated_at: string;
}
```

`canonical_url` derived, not PK — unique constraint is `(organization_id, platform, external_channel_id)`. Handle changes → `external_handle` + `canonical_url` update, `external_channel_id` stable.

---

## 4. Provider Architecture (capability-based, no god interface) — hardened

**Principle:** Core `features/sponsor-sentinel/services/evaluator.ts` depends on `Canonical*` observations, never on Helix/YouTube/Kick shapes. Provider boundary stops at `mappers.ts` per `src/server/integrations/{twitch,youtube,kick}/`.

**Evaluator must NOT import `twitch`/`youtube`/`kick` code.**

### 4.1 Small capability interfaces — only these

```ts
// Identity — one per platform
interface ChannelResolver {
  readonly platform: Platform;
  resolveChannel(handle: string): Promise<CanonicalChannel | null>; // canonical_url + ids
}

// Live observation — poll path
interface LiveStateProvider {
  readonly platform: Platform;
  getLiveState(channel: ConnectedChannel): Promise<CanonicalLiveStream | null>;
}

// Archive observation — poll path (Kick returns empty → caller maps to NOT_SUPPORTED for VOD rules)
interface VideoEvidenceProvider {
  readonly platform: Platform;
  listVideos(channel: ConnectedChannel, window: { from: string; to: string }): Promise<CanonicalVideo[]>;
}

// Category — minimal generic (FIX: no game_name in generic signature)
interface CanonicalCategory { id: string; name: string; platform: Platform; }
interface CategoryProvider {
  readonly platform: Platform;
  resolveCategory(categoryId: string): Promise<CanonicalCategory | null>; // id → name
  // Optional for UI search, not required for evaluator:
  // searchCategory?(query: string): Promise<CanonicalCategory[]>;
}

// Tags — typed, preserves semantics, still type-safe
interface CanonicalTag {
  id: string;              // Twitch: tag_id (e.g., "English"); YouTube/Kick: normalized label
  label: string;           // human label (lower-normalized for matching if needed)
  source: "twitch_curated" | "youtube_freeform" | "kick" | "kick_custom";
  platform: Platform;
}
interface TagProvider {
  readonly platform: Platform;
  listTags(channel: ConnectedChannel): Promise<CanonicalTag[]>; // empty if unsupported/null
}

// Capabilities descriptor — for deliverable validation (not a provider method)
interface ProviderCapabilities {
  readonly platform: Platform;
  supportsLiveState: boolean;      // all three true
  supportsVod: boolean;            // Kick false
  supportsDuration: boolean;       // Kick false
  supportsDescription: boolean;    // Kick false/unknown → false for MVP
  supportsCategory: boolean;       // all true
  tagSemantics: "curated" | "freeform" | "mixed"; // twitch curated, youtube freeform, kick mixed
  supportsEvents: boolean;         // all true but mechanisms differ
  pagination: { cursor: string; limitKey: "first"|"maxResults"|"limit"; maxLimit: number };
  budgetKind: "token_bucket" | "quota_bucket" | "unknown";
}
function getCapabilities(platform: Platform): ProviderCapabilities;
```

**Removed from 01A:**

| 01A interface | Decision in 01B | Rationale |
|---------------|-----------------|-----------|
| `CategoryProvider.resolveCategory(channel, game_name)` | **Removed** `game_name` param → `resolveCategory(categoryId)` with `CanonicalCategory` | `game_name` is Twitch-specific leakage into generic. Generic uses `id` + `name` + `platform`. Twitch `Get Games` name→id resolution stays inside Twitch mapper, not generic signature. |
| `TagProvider.listTags(): string[]` | **Replaced** → `CanonicalTag[]` with `source` discriminant | `string[]` loses curated vs freeform semantics. Discriminated `source` preserves difference while keeping typed. Evaluator uses platform-scoped rules (`required_twitch_tag` checks `source===twitch_curated`, etc.). |
| `EventProvider.subscribe(channel)` | **Removed from scanner/provider core** → split into 5 event responsibilities (see §6) | Subscription management does not belong in poll scanner. Conflates transport with observation. |

**Twitch adapter** implements `ChannelResolver` + `LiveStateProvider` (Get Streams + Get Channel Information) + `VideoEvidenceProvider` (Get Videos) + `CategoryProvider` (Get Games→CanonicalCategory) + `TagProvider` (Get Stream Tags→CanonicalTag curated). **YouTube** implements same but `TagProvider` returns `youtube_freeform` tags, `LiveStateProvider` uses `videos.list` with known `videoId` after discovery (search.list or PubSubHubbub → `videoId` → `videos.list`). **Kick** implements `LiveStateProvider` (Get Livestreams) + `ChannelResolver` + `CategoryProvider` + `TagProvider` (mixed), but `VideoEvidenceProvider.listVideos` returns `[]` and `supportsVod=false` → evaluator yields `NOT_SUPPORTED`.

No `StreamingPlatformProvider` god interface exists.

### 4.2 Why small interfaces

Avoids `if (platform === "twitch")` in evaluator — evaluator matches on `Canonical*`. Adding a provider = new adapter + `Platform` enum value + `getCapabilities()` entry, no `Campaign`/`Deliverable`/`Evidence` rewrite.

---

## 5. Normalized Observation Contract (canonical, platform-agnostic) — hardened

```ts
interface CanonicalCategory { id: string; name: string; platform: Platform; }

interface CanonicalTag {
  id: string;
  label: string;
  source: "twitch_curated" | "youtube_freeform" | "kick" | "kick_custom";
  platform: Platform;
}

interface CanonicalLiveStream {
  platform: Platform;
  external_id: string;        // Twitch stream id | YouTube video id (live) | Kick livestream uuid
  channel_id: string;         // external_channel_id
  title: string;
  description: string | null; // nullable — Kick live unknown
  category: CanonicalCategory | null;
  tags: CanonicalTag[];
  started_at: string | null;  // RFC3339
  url: string | null;         // https://twitch.tv/<login> | https://youtube.com/watch?v=... | https://kick.com/<slug>
  is_live: boolean;
}

interface CanonicalVideo {
  platform: Platform;
  external_id: string;        // Twitch video id | YouTube video id | null for Kick (not supported)
  channel_id: string;
  title: string;
  description: string | null;
  category: CanonicalCategory | null;
  tags: CanonicalTag[];       // YouTube freeform may populate; Twitch VOD tags via stream tags; Kick empty
  published_at: string | null; // snippet.publishedAt
  started_at: string | null;  // YouTube actualStartTime / Twitch created_at
  ended_at: string | null;    // YouTube actualEndTime
  duration_seconds: number | null; // parsed from Twitch "2h..." or YouTube PT..., null for Kick
  viewable: boolean | null;
  url: string | null;
  thumbnail: string | null;
}

// Evidence persistence (see EVIDENCE-MODEL.md, §10)
interface EvidenceRow {
  platform: Platform;
  external_channel_id: string;
  external_content_id: string | null; // live/video id
  evidence_type: "live_stream" | "video";
  source: "get_streams"|"get_channel_info"|"get_videos"|"get_stream_tags"|"youtube_channels_list"|"youtube_videos_list"|"youtube_search_list"|"kick_livestreams"|"kick_channels"|"event";
  // ... observed_at, observed_value, normalized_value, raw_ref, scanner_version
}
```

`mappers.ts` per provider converts Helix (`title`, `game_name`→CanonicalCategory via `Get Games`, `tag_id`→CanonicalTag) / YouTube (`snippet`+`contentDetails.duration` PT...+`liveStreamingDetails`) / Kick (`title`/`category`/`started_at`/`tags`/`custom_tags`) into these. Raw provider payload never reaches evaluator.

Optional future `CanonicalChatMessage`/`CanonicalOverlay` are **out of scope** (content-observable).

---

## 6. Scanning + Events (canonical flow + separated event responsibilities)

### 6.1 Canonical scan flow (platform-agnostic, synchronous scan-orchestrator does this)

```
DISCOVER → FETCH → NORMALIZE → EVALUATE → PERSIST EVIDENCE → PERSIST EVALUATION → PERSIST SCAN
```

| Step | Platform-agnostic description | Platform detail hidden in adapter |
|------|-------------------------------|-----------------------------------|
| DISCOVER | Cron lists `connected_channels where organization_id` + `sponsor_campaigns where window includes now` OR event notification provides `channel_id` + `external_content_id` | Twitch `Get Streams`/`Get Channel Information`, YouTube `PubSubHubbub` xml → `videoId` → `videos.list`, Kick `Get Livestreams` |
| FETCH | Adapter calls provider `getLiveState` / `listVideos` / `listTags` / `resolveCategory` with provider auth + `ProviderBudget` guard | Handles `after`/`pageToken`/`cursor`, `first`/`limit`, `Ratelimit-Remaining/Reset`, ETag `If-None-Match` |
| NORMALIZE | `mappers.ts` → `CanonicalLiveStream`/`CanonicalVideo`/`CanonicalTag`/`CanonicalCategory` | Parses Twitch `"2h..."`, YouTube `PT...`, lower/trims titles |
| EVALUATE | `evaluator.ts` (pure, deterministic) `rule + canonical → EvaluationResult` — **imports only canonical types** | Never imports `twitch`/`youtube`/`kick` |
| PERSIST EVIDENCE | Insert `evidence` immutable row (`platform`, `external_channel_id`, `external_content_id`, `evidence_type`, `source_url`, `observed_at/value/normalized_value/raw_ref/scanner_version`) | `on conflict` via `idempotency_key` |
| PERSIST EVALUATION | Insert `evaluations` linked to `evidence_id` (immutable, versioned) | New deliverable version → new evaluation |
| PERSIST SCAN | Insert `scans` row `idempotency_key = sha256(org+channel+campaign+window)` unique | `on conflict do nothing` dedupe |

**Stale/VOD delayed:** `Get Videos` empty after `stream.offline` → `PENDING`, retry next cron (15m). Never `FAIL`.

**Re-scan:** Editing `Deliverable.rules` creates new `Evaluation` for existing `Evidence`, old preserved.

### 6.2 Events — five separated responsibilities (01B hardening)

**Old `EventProvider.subscribe` is removed from scanner/provider core.** Subscription management is lifecycle, not per-scan polling. The five responsibilities are isolated, testable, reusable per provider:

```ts
// 1. Verification — did this request come from the provider? (never trust body alone)
interface EventVerifier {
  verify(request: Request, provider: Platform): Promise<{ valid: boolean; reason?: string }>;
  // Twitch: HMAC sha256(secret + id + timestamp + body) vs Twitch-Eventsub-Message-Signature, timestamp <10m
  // YouTube PubSubHubbub: GET hub.challenge echo (10s) for subscription; POST Atom not signed → treat as hint, always re-fetch via videos.list
  // Kick: RSA sha256(messageId.timestamp.body) vs Kick-Event-Signature base64 via GET /public/v1/public-key JWKS, timestamp <10m, messageId ULID dedupe
}

// 2. Parsing — bytes → typed untrusted event (no DB, no normalization yet)
interface EventParser {
  parse(rawBody: string, headers: Headers, provider: Platform): ParsedEvent; // ParsedEvent = { provider, type, external_channel_id?, external_content_id?, timestamp, raw }
  // Twitch: JSON EventSub envelope (stream.online/offline/channel.update) per eventsub-reference
  // YouTube: Atom <entry><yt:videoId><yt:channelId>
  // Kick: JSON livestream.metadata / chat.message per event-types
}

// 3. Normalization — untrusted event → CanonicalObservation or null (pure)
interface EventNormalizer {
  normalize(parsed: ParsedEvent): Promise<CanonicalLiveStream | CanonicalVideo | null>; // may fetch via adapter if Atom only has ids
  // YouTube Atom has only videoId+channelId+title — normalizer calls videos.list to enrich to CanonicalVideo before evaluate
}

// 4. Ingestion — canonical → evaluate → persist (reuses scan PERSIST steps, idempotent)
interface EventIngestor {
  ingest(canonical: CanonicalLiveStream | CanonicalVideo, source: "event"): Promise<void>;
  // does EVALUATE + PERSIST EVIDENCE/EVALUATION, dedupes via webhook_events+scans idempotency, never maps technical failure→FAIL
}

// 5. Subscription management — lifecycle separate from scan loop (admin/cron, not per-evaluation)
interface SubscriptionManager {
  subscribe(channel: ConnectedChannel): Promise<void>;   // create provider subscription
  unsubscribe(channel: ConnectedChannel): Promise<void>;
  listSubscriptions(organization_id: string): Promise<SubscriptionRow[]>;
  renewIfNeeded(): Promise<void>; // cron checks expiry
  // Twitch: POST /helix/eventsub/subscriptions (app token, callback+secret, condition broadcaster_id) + GET to list
  // YouTube: POST https://pubsubhubbub.appspot.com/subscribe (mode subscribe, callback, topic https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...)
  // Kick: POST /events/subscribe-to-events per docs
}
```

**Pipelines:**

- **Webhook route** `POST /api/webhooks/{twitch,youtube,kick}`: `verify` → `parse` → `normalize` → `ingest` → `200`. Verification failure → `401/403` no ingest. Duplicate `message_id`/`provider_event_id` → `webhook_events` unique → ignore.
- **Cron reconciler** `POST /api/cron/sentinel-scan` (Bearer `CRON_SECRET`): `DISCOVER`→`FETCH`→`NORMALIZE`→`EVALUATE`→`PERSIST*` for every channel/campaign. Also `SubscriptionManager.renewIfNeeded()`. Cron is **authoritative reconciler** — missed webhooks are backfilled here.
- **MVP**: Cron-only for all platforms; add `SubscriptionManager`+webhooks as enhancement after Cron is solid. Never assume webhook delivery.

### 6.3 Provider event vs poll matrix

| Provider | Poll primary | Event (optional, not MVP) | Verification | Dedupe |
|----------|--------------|---------------------------|--------------|--------|
| Twitch | `Get Streams`/`Get Channel Information`/`Get Videos` | `stream.online`/`offline`/`channel.update` (webhook/WebSocket/conduit) | `Twitch-Eventsub-Message-Signature` HMAC | `webhook_events(provider_event_id)` + `scans.idempotency_key` + `Message-Id` |
| YouTube | `channels.list` → discover → `videos.list` (1 unit, ETag 304) + `search.list` only after PubSubHubbub hint (100/day cap) | PubSubHubbub Atom `yt:videoId`/`yt:channelId` — **hint, not proof** — must re-fetch `videos.list` | `hub.challenge` echo for subscribe; POST Atom not signed — verify by re-fetch | `Atom <id> yt:video:VIDEO_ID` + `videos.list` ETag |
| Kick | `Get Users/livestreams` + `Get Channels`/`Categories` | `livestream.metadata` etc. per `events/subscribe-to-events` + `event-types` | `Kick-Event-Signature` RSA via `GET /public/v1/public-key` + `Kick-Event-Message-Id` ULID + `Timestamp` <10m | `Kick-Event-Message-Id` ULID + `webhook_events` |

---

## 7. Authentication Model (hardened) — public vs OAuth, MVP vs future, live monitoring verified

### 7.1 Three different auth models (Model C — not unified)

| Provider | Public (MVP, no user consent) | Private / future (user grant) | Token endpoint | Header |
|----------|-------------------------------|-------------------------------|----------------|--------|
| Twitch | **App Access Token** (`client_credentials`) per `https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow` → `expires_in` cached, refresh server-only | User token (`authorization_code` + scopes) only for private scopes; **EventSub webhook requires app token even if user token exists** per `https://dev.twitch.tv/docs/authentication/` | `POST https://id.twitch.tv/oauth2/token` (`client_id`+`client_secret`+`grant_type`) | `Authorization: Bearer <token>` + `Client-Id` |
| YouTube | **API key** `YOUTUBE_API_KEY` server-only (`key=API_KEY` query) for `channels.list`/`videos.list`/`search.list`/`videoCategories.list` public data — per `https://developers.google.com/youtube/v3/guides/authentication` — no user auth | **OAuth 2.0** (`authorization_code` + `refresh_token`, PKCE optional for installed apps, Google Cloud project + consent screen + scopes `youtube.readonly`/`youtube.force-ssl`) required for `liveBroadcasts.list`/`liveStreams.list`/`myRating`/`onBehalfOfContentOwner`/private videos — per `https://developers.google.com/youtube/registering_an_application` | `https://oauth2.googleapis.com/token` (Google) | `key=API_KEY` or `Authorization: Bearer <oauth>` |
| Kick | **App Access Token** (`client_credentials` → `https://id.kick.com/oauth/token`, scopes `channel:read`/`user:read`, 2FA + app from `https://kick.com/settings/developer` per `https://docs.kick.com/getting-started/kick-apps-setup.md` + `https://docs.kick.com/getting-started/generating-tokens-oauth2-flow.md` — auto-approved? still need app) | **User Access Token** (`authorization_code` + `code_verifier` PKCE) for `channel:write`/`events:subscribe`/`chat:write` etc. per `https://docs.kick.com/getting-started/scopes.md` | `POST https://id.kick.com/oauth/token` | `Authorization: Bearer <token>` |

Credentials live in `serverSchema` (`src/lib/env/schema.ts`) — `TWITCH_CLIENT_ID/SECRET`, `YOUTUBE_API_KEY` (new in 01B), `KICK_CLIENT_ID/SECRET` (new), never `NEXT_PUBLIC_`, never client, never logged.

### 7.2 What MVP can do without OAuth — explicitly verified for live monitoring

**YouTube live monitoring with API key only — correct path:**

- `channels.list?part=snippet&id=UC...` → verify channel exists + `customUrl`.
- Push hint: Subscribe `https://pubsubhubbub.appspot.com/subscribe` `hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...` → Atom `yt:videoId` + `yt:channelId` on upload/title update.
- Enrich: `videos.list?part=snippet,contentDetails,liveStreamingDetails&id=VIDEO_ID` (1 unit) → `snippet.liveBroadcastContent` (`live`/`upcoming`/`none`) + `snippet.title`/`snippet.tags[]`/`snippet.categoryId` + `liveStreamingDetails.actualStartTime/actualEndTime` + `contentDetails.duration PT...`.
- Discovery fallback: `search.list?part=snippet&channelId=UC...&type=video&eventType=completed|live` costs **1 unit, 100/day cap** (separate bucket) — use sparingly, not polling; prefer PubSubHubbub → `videos.list`.
- **OAuth NOT required for MVP** — API key suffices for public title/category/duration/VOD. `liveBroadcasts.list`/`liveStreams.list` are OAuth-only and **out of MVP**; they are future for low-latency `actualStartTime` without known `videoId`.

**Twitch** `Get Streams`/`Get Channel Information`/`Get Videos`/`Get Stream Tags`/`Get Games` all accept **app token** — no user consent for MVP.

**Kick** `Get Livestreams`/`Get Channels`/`Get Users`/`Get Categories` accept **app token** (`security: [UserAccessToken, AppAccessToken]` in OpenAPI) — no user consent for MVP public live.

**Future OAuth:** YouTube `liveBroadcasts.list` (1 unit, but requires OAuth) for true live without `videoId`; Kick `channel:write`/`events:subscribe` for webhook subscription management; Twitch user token only if private `analytics` needed. Do not block MVP on OAuth.

---

## 8. Quota / Budget — abstract ProviderBudget, no hard-coded 10_000 in business logic

**Hard constraint (01B):** Do NOT hard-code `10_000/day` into `if (quota < 10000)` business logic. Quota is a **provider implementation detail**, not domain invariant. Domain depends on `ProviderBudget` abstraction; provider adapters supply current numbers via `getCapabilities()` + `ProviderBudget` config, docs state current costs for reference.

```ts
interface ProviderBudget {
  readonly platform: Platform;
  checkBudget(cost: number): Promise<{ allowed: boolean; retryAfter?: string }>;
  consume(cost: number, opts?: { etag?: string; notModified?: boolean }): Promise<void>; // 304 → cost 0/free
  remainingText(): string; // for observability logs, not business branching
}

// Implementations:
// TwitchBudget — token bucket 800/min per client_id, reads Ratelimit-Remaining/Reset, 429 → wait until Reset, not FAIL
// YouTubeBudget — quota buckets: 10k general (1 per videos.list/channels.list/liveBroadcasts/list/liveStreams/list/videoCategories) + 100/day search.list (1) + 100/day videos.insert (1) + ETag 304 zero-cost via If-None-Match + gzip Accept-Encoding: gzip
// KickBudget — unknown → generic 429 backoff with jitter, respect Retry-After if present
```

**Current costs (reference, not code):** See `YOUTUBE-CAPABILITIES.md:Quotas`, `TWITCH-CAPABILITIES.md:6`, `KICK-CAPABILITIES.md:6` + `determine_quota_cost`.

- Twitch `Get Streams`/`Get Channel Information`/`Get Videos`/`Get Users`/`Get Games` = 1 point each inside 800/min bucket. Batch `?user_id=1&user_id=2` + `first=100` reduces calls.
- YouTube `videos.list`/`channels.list`/`videoCategories.list`/`playlistItems.list`/`liveBroadcasts.list`/`liveStreams.list` = **1 unit inside 10k bucket**; `search.list` = **1 unit inside 100/day bucket**; `videos.insert` = **1 inside 100/day bucket**; ETag `If-None-Match` → `304` avoids cost — per `https://developers.google.com/youtube/v3/getting-started#etags`. Do NOT poll with `search.list` — poll with `videos.list?id=` known ids.
- Kick unknown — assume token bucket, handle 429.

Scanner respects `ProviderBudget` — before `FETCH`, check; on 429/quota error → `PENDING`/`NOT_VERIFIABLE`, not `FAIL`, retry next cron.

---

## 9. Deliverable Validation — capability-driven, typed, Zod, junior-readable

Rules are **typed discriminated union, Zod validated, deterministic, extensible**, no `condition: string`.

```ts
type DeliverableRule =
  // Platform-neutral (all platforms support title/hashtag/category/window — but check capability)
  | { type: "required_title_contains"; value: string }         // normalized contains
  | { type: "required_hashtag"; value: string }                // normalized "#"+lower+trim
  | { type: "required_category"; categoryId: string; platform?: Platform } // references CanonicalCategory.id
  | { type: "required_streaming_window"; }                     // evidence start within campaign window — domain only
  // Platform-scoped — semantics differ (01B Tag hardening)
  | { type: "required_twitch_tag"; tag_id: string }            // curated Twitch tag_id (listTags source=twitch_curated)
  | { type: "required_youtube_tags"; tags: string[] }          // freeform snippet.tags[] exact lower match, any|all semantics documented
  | { type: "required_kick_tags"; tags: string[] }             // tags[]+custom_tags[] freeform
  // VOD-dependent (Kick NOT_SUPPORTED)
  | { type: "minimum_duration"; minutes: number }
  | { type: "required_vod_exists" }
  | { type: "required_description_contains"; value: string }
```

**Validation against capabilities:** At `Deliverable` creation/update, `getCapabilities(channel.platform)` is checked **per rule**:

- If `rule.type` requires `supportsVod` but `platform` has `supportsVod=false` (Kick) → **reject creation** with message `NOT_SUPPORTED on kick — no VOD endpoint` (or allow but evaluator yields NOT_SUPPORTED if multi-platform campaign — UX choice documented).
- UI shows supported capabilities per selected `ConnectedChannel.platform` via `getCapabilities()` — user **must not unknowingly create unverifiable rule**. API also validates server-side Zod + capability check — client hint is not authority.
- Multi-platform campaign with one unsupported platform → per-platform evaluation yields `NOT_SUPPORTED` badge for that platform, other platform may `PASS` — not `FAIL`.

**Normalization per rule** (same rule+evidence → same result, explicit, in `evaluator.ts`):

- Case `toLowerCase()` `en`, `trim()`+collapse `\s+→" "`, hashtag ensure `#` prefix, title `contains` (not exact/regex), tag exact `id` or lower exact for freeform, category exact `id`, duration parse (`"2h..."`=154, `PT1H2M3S`=3723→seconds→minutes compare `>=`).

---

## 10. Database Contract (conceptual, no migrations in 01B)

```sql
-- connected_channels — replaces twitch_channels
create table public.connected_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('twitch','youtube','kick')),
  external_channel_id text not null,
  external_handle text not null,
  display_name text,
  canonical_url text not null,
  connection_mode text not null check (connection_mode in ('discovered','authorized')) default 'discovered',
  connection_status text not null check (connection_status in ('connected','disconnected','expired','revoked')) default 'connected',
  authorized_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, external_channel_id)
);
-- indexes: connected_channels_org_idx(organization_id), platform, external_channel_id, authorized_at where authorized
-- RLS: enable row level security + policies using (is_org_member(organization_id)) — same pattern as 20250930000002_rls.sql
-- trigger: handle_updated_at on updated_at

-- sponsor_campaigns — platform-agnostic (no platform column; campaign may monitor multiple platforms via delivers)
-- deliverables — rules jsonb DeliverableRule[], campaign_id FK, no platform column (per-rule platform via capability check)
-- evidence — adds platform + external_channel_id + external_content_id + evidence_type enum('live_stream','video') + source enum per §5 + source_url + raw_ref minimal
-- evaluations — adds platform enum + rule_type + result enum('PASS','FAIL','NOT_VERIFIABLE','PENDING','NOT_SUPPORTED') + reason + evidence_id FK, immutable
-- scans — adds platform enum + connected_channel_id FK + started_at/finished_at/status + idempotency_key unique sha256(org+channel+campaign+window)

-- Every table: organization_id not null + enable row level security + is_org_member(organization_id) policy + indexes on organization_id/platform
-- webhook_events: provider in ('stripe','razorpay','twitch','discord','youtube','kick'), provider_event_id unique (covers all)
```

Confirm per requirements: **direct `organization_id`**, `platform` enum text check, `external_channel_id` identity, tenant-scoped uniqueness `unique(organization_id, platform, external_channel_id)`, indexes, RLS `is_org_member`, immutable Evidence (never update, old Evaluation preserved). See `DOMAIN.md:5` + `EVIDENCE-MODEL.md:2` + `ARCHITECTURE.md:10` for full.

---

## 11. Security Review (recheck per 01B §8)

| Risk | Mitigation (01B) | Where |
|------|------------------|-------|
| Tenant isolation / IDOR | Every new table `organization_id` + `enable row level security` + `using (is_org_member(organization_id))` helper `SECURITY DEFINER set search_path=public stable` granted `authenticated` only; `organization_id` derived from `requireOrganizationContext(orgSlug)` trusted `org.id`, never client `?organizationId=` | `security` skill, `postgres-rls` skill, `ARCHITECTURE.md:8` |
| OAuth state/PKCE | Twitch not needed MVP (app token); YouTube OAuth future uses `state` random + PKCE `code_verifier`/`code_challenge` + `redirect_uri` strict; Kick PKCE `code_verifier` per `generating-tokens-oauth2-flow`; store `state` in httpOnly cookie, compare on callback; refresh token encrypted at rest (Supabase Vault or `pgp_sym_encrypt` future) | §7, `KICK-CAPABILITIES.md`, `TWITCH-CAPABILITIES.md` |
| API key/token secrecy | `YOUTUBE_API_KEY` server-only `src/lib/env/schema.ts` `serverSchema`, never `NEXT_PUBLIC`, never client, never log, rotated via env; `TWITCH_CLIENT_SECRET`/`KICK_CLIENT_SECRET` same; service_role only in `src/lib/supabase/admin.ts` | `security` skill, `src/lib/env/schema.ts` |
| Webhook verification | Twitch: `Twitch-Eventsub-Message-Signature: sha256(secret+id+timestamp+body)` + `Message-Id` dedupe + `Message-Timestamp` <10m per `handling-webhook-events`; YouTube PubSubHubbub: `hub.challenge` echo 10s subscribe; Kick: `Kick-Event-Signature` RSA `sha256(messageId.timestamp.body)` via `GET /public/v1/public-key` + `Kick-Event-Message-Id` ULID + `Timestamp` <10m per `webhook-security` | §6.2, skills |
| Replay protection | Check `timestamp` not older than 10m for Twitch/Kick; dedupe `message_id`/`provider_event_id` via `webhook_events` unique; scans idempotency_key | §6 |
| Event deduplication | `webhook_events(provider_event_id unique)` + `scans.idempotency_key` `on conflict do nothing`; Atom `yt:videoId` + ETag 304 | §6 |
| Malicious provider payloads | Zod validate Helix/videos/kick response before mapper; store `raw_ref` minimal (id+url) not full dump; escape `title`/`description` in report (XSS); do not execute provider `url` as code | `EVIDENCE-MODEL.md`, `ARCHITECTURE.md:8` |
| Report access | `requireOrganizationContext` + `requireEntitlement(orgId,'sponsor-sentinel')` for every `/dashboard/[orgSlug]/sponsor-sentinel/report` — same as stub `sponsor-sentinel/page.tsx`; RLS ensures member-only evidence/evaluations | `DOMAIN.md:7`, `security` skill |
| Cross-provider leakage | `platform` in RLS + `organization_id` + evaluator never branches on raw provider shape; `getCapabilities` gate prevents mixing tag semantics | §4-5 |
| Quota exhaustion not FAIL | Technical 429/403 quota → `PENDING`/`NOT_VERIFIABLE` with reason `rate_limited until Reset` / `quota_exhausted` — never `FAIL` | §8, `EVIDENCE-MODEL.md:4` |

---

## 12. Zero-Cost Review (recalculated per 01B §8)

Assumptions: poll intervals respect `ProviderBudget`; YouTube discovery via `videos.list?id=` (1 unit general bucket) + PubSubHubbub hints; avoid `search.list` polling (100/day cap).

| Scale | Twitch (800/min) | YouTube (10k general + 100 search/day) | Kick (unknown, assume 429 backoff) | Verdict |
|-------|------------------|----------------------------------------|------------------------------------|---------|
| 1 org / 3 channels, cron every 15m (96 polls/day) | 3*96=288 `Get Streams` + ~10 VOD = 300/day = 0.2/min <<800 | 3*96=288 `videos.list` (1 each) if using known videoIds after PubSubHubbub; if polling `videos.list` naively 288 <10k general ✓; `search.list` not used for polling → 0/100 | <500/day | **$0** — infra Supabase free + Vercel Cron free, all APIs free tier, no paid queue |
| 10 orgs / 30 channels, 15m poll | 30*96=2880 `Get Streams`/day = 2/min <<800 | 30*96=2880 `videos.list` general = 28% of 10k ✓; but if 30 channels all push new video same hour, PubSubHubbub fans out | ~3000/day | **$0** — still within Twitch 800/min, YouTube 10k at 28% — factor 3 headroom |
| 100 orgs / 300 channels, 15m poll | 300*96=28,800/day = 20/min avg, burst 300/min <800 but near danger if multiple campaigns per channel | 300*96=28,800 `videos.list`/day = **288% of 10k → quota exhausted** → must reduce poll to 60m (300*24=7200/day <10k) + ETag `304` (unchanged `videos.list` returns 304 zero-cost) + `search.list` still 0/100 if avoided | Burst 300/min maybe > unknown Kick limit → need backoff queue | **First real constraint is YouTube general quota 10k/day** (not Twitch 800/min). At 300 channels, 15m poll impossible; 60m poll + ETag saves it. No paid infra yet, but **first time need to request YouTube quota extension** via `https://support.google.com/youtube/contact/yt_api_form` (free but requires Google audit) — still $0 but operational ticket. |

**Conclusion:** `$0-before-first-customer` holds for 1-10 orgs at 15m poll. **100 orgs / 300 channels is where 01A's 10k math becomes binding** — must switch YouTube to 60m cron + ETag + PubSubHubbub push to stay free, or request quota extension (still $0, just audit). Twitch 800/min only becomes first constraint if YouTube optimized with ETag/push. Kick limit unknown but likely looser than YouTube quota.

Infra cost remains $0 (Supabase free tier rows ~14k/org/month evidence at 15m poll × 5 channels × 30 days — within limits; `raw_ref` minimal; retention 90 days future).

---

## 13. Evaluation States (final, per §4 evaluator)

```
PASS | FAIL | NOT_VERIFIABLE | PENDING | NOT_SUPPORTED
```

| State | Meaning | Example |
|-------|---------|---------|
| `PASS` | Evidence proves compliance | `title` contains `#OurBrand` normalized, `categoryId` matches |
| `FAIL` | Evidence proves non-compliance (capability exists, observation available) | VOD `title` missing hashtag, `duration` 90 < 120 |
| `NOT_VERIFIABLE` | Platform supports capability but **this observation cannot prove** (deleted VOD, empty description, 429, channel renamed, `viewable` not public) | `Get Videos` 0 results but window not closed, broadcaster deleted VOD, `published_at` null |
| `PENDING` | Evidence **may become available later** — not yet scanned or VOD delayed | `stream.offline` just fired, `Get Videos` not yet appears (1-10m), next cron will retry |
| `NOT_SUPPORTED` | **Provider cannot provide capability** at all | `required_vod_exists`/`minimum_duration` on Kick (no VOD endpoint) |

**Technical/API failures → never `FAIL`.** 429/quota/503/malformed payload → `PENDING` or `NOT_VERIFIABLE` with reason, retry next cron. Report shows reason, not compliance.

---

## 14. Changes from 01A (hardening)

| Area | 01A | 01B (hardened) | Why |
|------|-----|----------------|-----|
| YouTube quota cost | `search.list` documented as **100 units** | Corrected to **1 unit, 100/day separate bucket** per 2026-09-15 `determine_quota_cost` revalidation | 01A assumed old 100-cost model; official calculator now shows separate 100/day bucket. Polling strategy changes. |
| YouTube auth | “API key OR OAuth — public title via API key” vague | **Split public (API key) vs private (OAuth) capabilities explicitly**; MVP vs future table; live monitoring path `channels.list`→PubSubHubbub→`videos.list` verified | Resolves ambiguity: what needs OAuth (`liveBroadcasts.list`/`liveStreams.list`/`myRating`) vs what API key can do. |
| YouTube live monitoring | “PARTIAL `liveBroadcastContent`” | **Explicit discovery problem**: `videos.list` needs known `videoId`; PubSubHubbub hint + `search.list` (100/day cap) is discovery; not EventSub | Prevents assuming `videos.list` alone polls live without ids. |
| Provider quota model | `ProviderBudget` mentioned but YouTube hard-coded `10k` in logic | **No hard-coded 10k in business logic** — `ProviderBudget` abstraction, current costs in docs/capabilities only | Enforces hard constraint: business logic must not branch on 10_000. |
| Category interface | `resolveCategory(channel, game_name)` | **`resolveCategory(categoryId)` → `CanonicalCategory {id,name,platform}` — no `game_name`** | `game_name` leaked Twitch `Get Games` semantics into generic. |
| Tag interface | `listTags(): string[]` | **`listTags(): CanonicalTag[]` with `source` discriminant** | `string[]` lost curated vs freeform semantics. |
| Tag rules | three rule types but provider string[] ambiguous | **Three rule types remain, provider now returns `CanonicalTag[]` with platform semantics** — evaluator checks `source` | Cleanest type-safe model preserving differences. |
| Events | `EventProvider.subscribe(channel)` giant | **Removed from scanner core; split into 5: `EventVerifier`/`EventParser`/`EventNormalizer`/`EventIngestor`/`SubscriptionManager`** | Resolves “subscription management inappropriate in scanner” + separates concerns. |
| ConnectedChannel | `connection_status: connected/disconnected/expired` only | **Added `connection_mode: discovered/authorized` + `authorized_at` + expanded status `revoked`** | Clarifies publicly discovered vs OAuth-authorized; they are not equated. |
| Kick VOD | “NO / UNKNOWN treat as NOT_SUPPORTED” | **Confirmed NOT_SUPPORTED** after 2026-09-30 sitemap revalidation (no `videos` endpoint, only livestreams) | Explicit revalidation. |
| Pagination doc | Mixed | **Per-provider `limitKey`/`maxLimit` in capabilities**: Twitch `first` 100, YouTube `maxResults` 50 + `pageToken`, Kick `limit` 1000 `next_cursor` | Prevents unified pagination assumption. |
| Scanning flow | `DISCOVER→...→PERSIST SCAN` | **Kept** but added event pipeline `verify→parse→normalize→ingest` + Cron as reconciler + subscription manager separate | Meets §6 requirement: Cron + Twitch EventSub + YouTube push + Kick webhook architecture, none implemented. |
| Database | `connected_channels` concept but missing `connection_mode` | **Added `connection_mode`/`authorized_at`/expanded status/indexes/RLS + `webhook_events` includes youtube/kick + `evidence.source` includes `youtube_*`/`kick_*`** | Fulfills §7 DB contract. |
| Skills/docs | 01A shipped skills but quota stale | **Revalidated all three skills vs official docs 2026-09-30** | Keeps skills authoritative. |

---

## 15. Answers to Required Decisions (A–N) — final

**A. TwitchChannel → ConnectedChannel?** Yes — + `connection_mode` (§3).

**B. Platform enum:** `twitch`/`youtube`/`kick` lowercase, `check (platform in ...)`.

**C. Provider boundary:** Five small capability interfaces + `CanonicalCategory`/`CanonicalTag` (§4). Evaluator depends only on canonical.

**D. Canonical evidence:** `Evidence` adds `platform`/`external_channel_id`/`external_content_id`/`evidence_type`/`source_url` per `EVIDENCE-MODEL.md`.

**E. Deliverable rules:** Platform-neutral + platform-scoped (§9). Cross-platform validation via `getCapabilities()`.

**F. Unsupported:** `NOT_SUPPORTED` + creation-time validation (§9, §13).

**G. Evaluation:** Five states (§13).

**H. Auth:** Model C separate per provider §7 — Twitch app, YouTube API key (MVP) vs OAuth (future), Kick app/user via PKCE.

**I. Scanning:** Cron-only MVP; EventSub/PubSubHubbub/Kick webhook as enhancement with Cron reconciler (§6). `SubscriptionManager` separate.

**J. Quotas:** `ProviderBudget` abstraction, no hard-coded 10k, ETag + `Retry-After` + `429` backoff (§8).

**K. Tables:** §10 concept — `connected_channels` with mode/status, sponsor_campaigns/deliverables/evidence/evaluations/scans with platform+RLS+indexes+immutable evidence.

**L. Security:** §11 table.

**M. $0 still holds?** §12 — yes until ~300 channels at 15m; first constraint is YouTube general quota 10k (not Twitch 800).

**N. MVP:** Twitch full (title/hashtag/curated tag/category/window/duration/VOD) + YouTube read-only title/category/VOD via `videos.list` (API key) + Kick live title/category only (no VOD) — capability validation proves `ConnectedChannel`+`NOT_SUPPORTED`.

---

## 16. Extensibility (next platform)

Add provider = new adapter `src/server/integrations/<provider>/{client,types,mappers,budget}.ts` + `Platform` enum value + `connected_channels` check update + `getCapabilities()` entry + `SubscriptionManager` + event verifier/parser/normalizer if needed. No `SponsorCampaign`/`Deliverable`/`Evidence` rewrite. Not a plugin framework — just `ConnectedChannel` + small capability interfaces.

---

## 17. Implementation Contract for RCCF-SENTINEL-02 (exact)

> **Scope lock for 02:** Implement the abstractions proven here, but do NOT add unproven capabilities.

**02 must:**

1. Create `Platform` enum + `CanonicalCategory`/`CanonicalTag`/`CanonicalLiveStream`/`CanonicalVideo` types in `src/features/sponsor-sentinel/types.ts` (or `src/server/integrations/shared/canonical.ts`) — **no provider imports in evaluator**.
2. Create `src/server/integrations/{twitch,youtube,kick}/mappers.ts` stubs that convert mocked Helix/YouTube/Kick shapes → canonical (pure functions, tested).
3. Create `src/server/integrations/{twitch,youtube,kick}/client.ts` skeletons: `ChannelResolver`+`LiveStateProvider`+`VideoEvidenceProvider`+`CategoryProvider`+`TagProvider` + `ProviderBudget` (Twitch 800/min headers, YouTube ETag/Quota bucket, Kick 429). No real `fetch` to external needed — mock/batch safe.
4. Add `YOUTUBE_API_KEY`, `KICK_CLIENT_ID/SECRET` to `src/lib/env/schema.ts` `serverSchema` (optional until used), keep server-only.
5. Write **no migrations** in 02 — DB contract stays conceptual (§10) until RCCF-03.
6. Implement `evaluator.ts` pure `rule + canonical → EvaluationResult` with five states, comprehensive tests (all rule types, `NOT_SUPPORTED` on Kick VOD/duration).
7. Implement `Deliverable` Zod schema + capability validation `validateRulesForPlatform(platform, rules)` → rejects `NOT_SUPPORTED` combos.
8. Wire `SubscriptionManager` interface stubs + `EventVerifier`/`Parser`/`Normalizer` interfaces (no route wiring yet) — prove separation.
9. Keep `connected_channels` types/validators reflecting `connection_mode` (`discovered` default).
10. Verify `npm run typecheck && npm run lint && npm run test && npm run build` + no `any`, no provider leakage into evaluator, no hard-coded 10000 branching, git clean except `src/` scaffolding.

**02 must NOT:** migrations/CRUD implementation, real OAuth token flows, real `fetch` to Helix/YouTube/Kick, cron wiring (`vercel.json`), webhook routes, UI/billing/AI/ASR/OCR, ETag network code beyond interface, or `game_name` in generic interfaces.

---

## 18. Next RCCF Task

**RCCF-SENTINEL-03 — Persistence + Tenant-Scoped CRUD**

> After 02 stubs are type-safe and tested, 03 will add conceptual tables as **real migrations** (`connected_channels`, `sponsor_campaigns`, `deliverables`, `evidence`, `evaluations`, `scans` + `webhook_events` expansion) with RLS/ indexes/ immutability, plus repository + service CRUD (server-only) with `requireOrganizationContext`+`requireEntitlement` guards, staying behind `features/sponsor-sentinel/` barrel. No scanner/cron/webhook wiring until 04.

---

## 19. References (revalidated 2026-09-30)

- Twitch auth `https://dev.twitch.tv/docs/authentication/` + client credentials `https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow`
- Twitch rate limits `https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits` + pagination `https://dev.twitch.tv/docs/api/guide/#pagination` + reference `https://dev.twitch.tv/docs/api/reference/`
- Twitch EventSub `https://dev.twitch.tv/docs/eventsub/` + `eventsub-reference` + `handling-webhook-events`
- YouTube getting started `https://developers.google.com/youtube/v3/getting-started#quota` + costs `https://developers.google.com/youtube/v3/determine_quota_cost` (2026-09-15) + auth `https://developers.google.com/youtube/v3/guides/authentication` + push `https://developers.google.com/youtube/v3/guides/push_notifications` + `videos/list` `https://developers.google.com/youtube/v3/docs/videos/list`
- Kick `https://docs.kick.com/sitemap.md` + `https://docs.kick.com/apis/livestreams.md` + `https://docs.kick.com/apis/channels.md` + `https://docs.kick.com/apis/users.md` + `https://docs.kick.com/getting-started/kick-apps-setup.md` + `https://docs.kick.com/getting-started/generating-tokens-oauth2-flow.md` + `https://docs.kick.com/events/webhook-security.md` + `https://docs.kick.com/events/subscribe-to-events.md` + `public-key` `https://docs.kick.com/apis/public-key.md`
- Repo `EVIDENCE-MODEL.md`, `DOMAIN.md`, `ARCHITECTURE.md`, `TWITCH-CAPABILITIES.md`, `YOUTUBE-CAPABILITIES.md`, `KICK-CAPABILITIES.md`
