# YouTube Capabilities — Sponsor Sentinel

> **Source:** Google YouTube Data API v3 — https://developers.google.com/youtube/v3/docs, https://developers.google.com/youtube/v3/getting-started, https://developers.google.com/youtube/v3/docs/videos/list, https://developers.google.com/youtube/v3/guides/authentication. Revalidated **2026-09-30** — quota costs corrected per https://developers.google.com/youtube/v3/determine_quota_cost (2026-09-15). Verify before implementing; quota/policy changes.

---

## 1. Authentication — public (API key) vs OAuth — MVP vs future

### API Key (read-only public, no OAuth) — MVP

- `GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id=VIDEO_ID&key=API_KEY` — https://developers.google.com/youtube/v3/guides/authentication
- Works for `videos.list`, `channels.list`, `videoCategories.list`, `playlistItems.list`, `search.list` on **public** data only. No private, no `myRating`, no `onBehalfOfContentOwner`, no `liveBroadcasts`/`liveStreams`.
- Keep `YOUTUBE_API_KEY` **server-only** (`src/lib/env/schema.ts` `serverSchema`), never `NEXT_PUBLIC_`, never client.

### OAuth 2.0 (user-authorized) — future / private

- Flows: server-side `authorization_code` + `refresh_token` (PKCE optional for installed apps) — https://developers.google.com/youtube/v3/guides/authentication. Requires Google Cloud project, enable YouTube Data API, consent screen, scopes like `https://www.googleapis.com/auth/youtube.readonly` or `youtube.force-ssl`. See https://developers.google.com/youtube/registering_an_application.
- **Required for:** `liveBroadcasts.list` (1 unit), `liveStreams.list` (1), `myRating`, `onBehalfOfContentOwner`, private/unlisted videos, `fileDetails`/`processingDetails`/`suggestions` (owner-only). Out of MVP unless sponsor requires private livestream verification.
- **For Sentinel MVP:** Public title/category/description/duration/VOD existence use **API key** (no OAuth). Live status via `videos` `snippet.liveBroadcastContent` + `liveStreamingDetails` **after known videoId from PubSubHubbub or search** — still API key. `liveBroadcasts.list` is future low-latency alternative requiring OAuth.

**Implication:** Twitch App Token (application-only, 800/min, no user consent) ↔ YouTube **API key** (public, quota bucket). Do not force identical auth.

### Quota — provider budget, not hard-coded business logic (01B correction)

- **General bucket:** 10,000 units/day for `videos.list`/`channels.list`/`videoCategories.list`/`playlistItems.list`/`liveBroadcasts.list`/`liveStreams.list`/`subscriptions.list` etc. — each cost **1** per https://developers.google.com/youtube/v3/determine_quota_cost. Quota table lists them at cost 1. See https://developers.google.com/youtube/v3/getting-started#quota.
- **Separate 100/day buckets (cost 1 each):** `search.list` — "100 quota per day. Each call costs 1 quota." per quota calculator (2026-09-15). Same for `videos.insert` (100/day, 1 each). **Old docs claiming `search.list` = 100 units inside 10k bucket are stale** — revalidated 2026-09-30. Do NOT poll with `search.list` — cap is 100/day, not 100 cost.
- Request additional quota via `https://support.google.com/youtube/contact/yt_api_form` if needed per https://developers.google.com/youtube/v3/getting-started#quota.
- **Abstraction:** Business logic must depend on `ProviderBudget` interface, not `if (quota < 10000)` hard code. Current bucket sizes/costs are provider config + docs, not domain invariant — see `MULTI-PLATFORM.md:8`.

**Docs:** https://developers.google.com/youtube/v3/getting-started#quota, https://developers.google.com/youtube/v3/determine_quota_cost

---

## 2. Endpoint Catalog (relevant, revalidated)

| Endpoint | URL | Purpose | Auth | Pagination / Cost | Key fields (evidence) | Docs |
|----------|-----|---------|------|-------------------|----------------------|------|
| **Channels: list** | `GET https://www.googleapis.com/youtube/v3/channels?part=snippet&id=CHANNEL_ID&key=API_KEY` | Resolve channel handle → `UC...` id, verify existence | API Key (public) or OAuth | `pageToken` not needed for single, **cost 1** inside 10k bucket | `snippet.title`, `snippet.description`, `snippet.customUrl` (handle) | https://developers.google.com/youtube/v3/docs/channels/list |
| **Videos: list** | `GET https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails&id=VIDEO_ID` | Video metadata — **core for archived livestream + live status after known id** | API Key (public) | `maxResults` not for `id` mode, `pageToken` only for `myRating`/`chart`, **cost 1** per https://developers.google.com/youtube/v3/docs/videos/list | `snippet.title`, `snippet.description`, `snippet.tags[]` (freeform), `snippet.categoryId`, `snippet.publishedAt`, `snippet.channelId`, `contentDetails.duration` (`PT1H2M3S` ISO8601), `liveStreamingDetails.actualStartTime`/`actualEndTime`/`scheduledStartTime`, `snippet.liveBroadcastContent` (`upcoming`/`live`/`none`) | https://developers.google.com/youtube/v3/docs/videos/list |
| **Search: list** | `GET .../search?part=snippet&channelId=CHANNEL_ID&type=video&eventType=completed|live` | Discover archived livestreams for channel (only when PubSubHubbub not available) | API Key / OAuth | `pageToken`, `maxResults` 1-50, **cost 1 per call, 100/day cap** per quota calculator 2026-09-15 — **not 100 cost** — use sparingly, not polling | `id.videoId`, `snippet.title`, `snippet.publishedAt` | https://developers.google.com/youtube/v3/determine_quota_cost |
| **VideoCategories: list** | `GET .../videoCategories?part=snippet&id=CATEGORY_ID` | Resolve `categoryId` → name → `CanonicalCategory` | API Key | **cost 1** | `snippet.title` (e.g., "Gaming" id 20) | https://developers.google.com/youtube/v3/docs/videoCategories/list |
| **LiveBroadcasts: list** | `GET .../liveBroadcasts?part=snippet&id=...&broadcastStatus=active` | Live broadcast status (requires OAuth — **future, not MVP**) | **OAuth only** | **cost 1** | `snippet.title`, `liveStreamingDetails` | https://developers.google.com/youtube/v3/docs/liveBroadcasts/list |
| **LiveStreams: list** | `GET .../liveStreams?part=snippet&id=...` | Live stream resource (requires OAuth — **future**) | **OAuth only** | **cost 1** | `snippet.title` | https://developers.google.com/youtube/v3/docs/liveStreams/list |
| **Activities: list** | `GET .../activities?part=snippet&channelId=...` | Recent channel activities (may include uploads) | API Key | **cost 1** | `snippet.type` | https://developers.google.com/youtube/v3/docs/activities/list |

**Timestamps:** YouTube `publishedAt`, `actualStartTime` RFC3339 `YYYY-MM-DDTHH:MM:SSZ` per https://developers.google.com/youtube/v3/docs/videos#snippet.publishedAt. `duration` ISO8601 `PT#H#M#S`.

**Tags:** `snippet.tags[]` freeform uploader-set per https://developers.google.com/youtube/v3/docs/videos#snippet.tags — closer to hashtags but not Twitch's curated `tag_id`.

**Live status:** `snippet.liveBroadcastContent` = `live`|`upcoming`|`none` per `https://developers.google.com/youtube/v3/docs/videos#snippet.liveBroadcastContent`. `liveStreamingDetails.actualStartTime`/`actualEndTime` for completed livestreams.

**Pagination:** `pageToken`/`nextPageToken`/`prevPageToken`, `maxResults` 1-50 only for `myRating`/`chart` modes; `id` mode not paginated — https://developers.google.com/youtube/v3/docs/videos/list#pageToken

---

## 3. VOD / Archive Behavior

- **Archived livestream** is a `video` with `liveStreamingDetails` present and `snippet.liveBroadcastContent=none` after end. Appears via PubSubHubbub Atom or `search?eventType=completed` or known `videoId`.
- **Discovery problem:** `videos.list` needs known `videoId`. MVP discovery is **PubSubHubbub hint → `videoId` → `videos.list`** (no search polling). `search.list` is fallback capped 100/day.
- **Delay:** 1-10m after `actualEndTime`.
- **Deletion:** Uploader can delete/privatize; `videos.list?id=` then empty or error `videoNotFound`.

---

## 4. Events / Push

- **PubSubHubbub (WebSub)** per `https://developers.google.com/youtube/v3/guides/push_notifications`: `POST https://pubsubhubbub.appspot.com/subscribe` with `hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...`, `hub.callback`, verify `hub.challenge` (10s echo). Atom `<entry>` contains `<yt:videoId>` + `<yt:channelId>` + `<title>` — **hint, not proof**; must re-fetch `videos.list` to canonicalize.
- Payload format 2026-09: `https://developers.google.com/youtube/v3/guides/push_notifications#notification_format` — Atom `feed > entry > yt:videoId/yt:channelId/published/updated`.
- **No EventSub equivalent** like Twitch `stream.online` — PubSubHubbub is upload/title update, not live start webhook. Polling `videos.list` after hint is primary.

---

## 5. Limitations for Sentinel

- **Tags semantics differ:** YouTube `snippet.tags[]` freeform vs Twitch curated → need `required_youtube_tags` vs `required_twitch_tag` → `CanonicalTag` with `source` discriminant (see MULTI-PLATFORM.md:4).
- **Quota is budget, not hard code:** 10k general + 100/day search are **provider config**, not `if (quota===10000)` branching. `ProviderBudget` abstraction tracks `videos.list` 1-cost + ETag 304 saves + 100/day search cap. First constraint at 100 orgs/300 channels is general 10k if polling `videos.list` 15m (28.8k/day >10k) — mitigate with 60m poll + ETag + PubSubHubbub.
- **Auth split explicit:** Public API key suffices for MVP public metadata; `liveBroadcasts`/`liveStreams` OAuth is **future** — see MULTI-PLATFORM.md:7.

---

## 6. Rate / Quota Implications per Requirement (recalculated)

- **Title/hashtag/category/VOD/description:** `videos.list?part=snippet` 1 unit inside 10k → for 30 channels polling 96/day = 2880/day (28% of 10k) — ok at 10 orgs; 300 channels 15m = 28.8k/day >10k → must use 60m poll (7200/day) + `If-None-Match` ETag 304 savings per https://developers.google.com/youtube/v3/getting-started#etags.
- **Live detection:** `videos.list` with `liveStreamingDetails` after PubSubHubbub hint (1 unit) — cheap. Do not use `search?eventType=live` polling (waste of 100/day cap).
- **ETag:** `If-None-Match: "<etag>"` → `304 Not Modified` zero-cost — per `https://developers.google.com/youtube/v3/getting-started#etags`. Cache per channel/videoId.
- **Gzip:** `Accept-Encoding: gzip` per guide.

---

## 7. Checklist

- [ ] Did I cite `https://developers.google.com/youtube/v3/docs/videos/list` for `part`/`snippet` fields?
- [ ] Did I use API key server-only, never client, and separate OAuth (`liveBroadcasts`/`liveStreams`) as future?
- [ ] Did I treat `search.list` as 1-cost, 100/day cap — not 100-cost — and avoid polling with it?
- [ ] Did I handle `liveBroadcastContent` + `actualStartTime` + `PT...` duration + RFC3339?
- [ ] Did I implement ETag `If-None-Match` → 304 and gzip?
- [ ] Did I verify PubSubHubbub `hub.challenge` is hint → re-fetch `videos.list`?

