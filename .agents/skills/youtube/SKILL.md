---
name: youtube
description: "Use for YouTube Data API v3 in Sponsor Sentinel — API key vs OAuth (public vs liveBroadcasts), videos.list/channels.list, quota buckets (10k general + 100/day search, ETag), PubSubHubbub hints, and limitations. Verify docs; do not assume Twitch equivalence."
---

# YouTube — Data API v3 (Project-Bounded)

**When to use:** Any change to `src/server/integrations/youtube/` or when evaluating YouTube observability for deliverables.

**When not to use:** Twitch/Kick-only changes, pure UI without YouTube.

**Installed context (05B real):** Real client `src/server/integrations/youtube/client.ts:22` API-key only (`YOUTUBE_API_KEY` server-only, fixed `https://www.googleapis.com/youtube/v3`, key via `?key=` redacted in errors). Real provider `src/server/integrations/youtube/provider.ts:1` implements `ChannelResolver` (`channels.list?id/forHandle`), `LiveStateProvider` (`search.list eventType=live` + `videos.list`), `VideoEvidenceProvider` (`search.list completed` + `videos.list` window filter), `CategoryProvider` (`videoCategories.list` cached), `TagProvider` (`youtube_freeform`). Registry `src/server/integrations/registry.ts:22` (`youtube` real when `YOUTUBE_API_KEY` present else mock). Revalidated **2026-09-30** — `search.list` **1 cost, 100/day cap**.

## Authentication — public (MVP) vs OAuth (future) — explicitly split

- **API Key (public data, MVP — no OAuth):** `GET https://www.googleapis.com/youtube/v3/videos?part=snippet&id=VIDEO_ID&key=API_KEY` — https://developers.google.com/youtube/v3/guides/authentication. Works for `videos.list`, `channels.list`, `videoCategories.list`, `playlistItems.list`, `search.list` **public only**. No `myRating`, no `liveBroadcasts`/`liveStreams`, no private. Keep `YOUTUBE_API_KEY` server-only, never `NEXT_PUBLIC`.
- **OAuth 2.0 (private/future):** `authorization_code` + `refresh_token` per https://developers.google.com/youtube/v3/guides/authentication, scopes `https://www.googleapis.com/auth/youtube.readonly` etc., Cloud project + consent screen. Required for `liveBroadcasts.list`/`liveStreams.list`/`myRating`/`onBehalfOfContentOwner`. Out of MVP unless sponsor requires private verification.
- **Why different from Twitch:** Twitch App Token (client_credentials, 800/min) is app-only; YouTube public uses **API key** (quota buckets) vs OAuth — do not force identical auth.
- **Live monitoring with API key only:** `channels.list` verify → PubSubHubbub hint `yt:videoId` → `videos.list` with `snippet.liveBroadcastContent` + `liveStreamingDetails.actualStartTime/actualEndTime` + `contentDetails.duration PT...`. `liveBroadcasts.list` is future OAuth alternative.

## Endpoints Relevant to Sentinel

| Endpoint | Purpose | Auth | Cost / Bucket | Fields |
|----------|---------|------|------|--------|
| `GET /youtube/v3/channels?part=snippet&id=UC...&key=...` | Resolve handle → channel | API Key | **1 inside 10k** | `snippet.title`, `snippet.description`, `snippet.customUrl` |
| `GET /youtube/v3/videos?part=snippet,contentDetails,liveStreamingDetails&id=VIDEO_ID` | Video metadata (core) | API Key (public) | **1 inside 10k** | `snippet.title`, `snippet.description`, `snippet.tags[]` (freeform), `snippet.categoryId`, `snippet.publishedAt`, `contentDetails.duration` (`PT1H2M3S`), `liveStreamingDetails.actualStartTime`/`actualEndTime`, `snippet.liveBroadcastContent` |
| `GET /youtube/v3/search?part=snippet&channelId=...&type=video&eventType=completed` | Discover archived livestreams — **fallback only, 100/day cap** | API Key / OAuth | **1 per call, 100/day separate bucket** per quota calculator 2026-09-15 | `id.videoId`, `snippet.publishedAt` |
| `GET /youtube/v3/videoCategories?part=snippet&id=...` | Resolve `categoryId` → name → `CanonicalCategory` | API Key | **1** | `snippet.title` |
| `GET /youtube/v3/liveBroadcasts?part=snippet&id=...` | Live broadcast (requires OAuth — future) | **OAuth only** | **1** | `snippet.liveStreamingDetails` |
| `GET /youtube/v3/liveStreams?part=snippet&id=...` | Live stream resource (requires OAuth — future) | **OAuth only** | **1** | `snippet.title` |

**Timestamps:** RFC3339. `duration` ISO8601 `PT#H#M#S`.

## Quota & Budget (hardened — no hard-coded 10_000 in business logic)

- **ProviderBudget abstraction:** Domain depends on `ProviderBudget.checkBudget/consume` per `MULTI-PLATFORM.md:8`, not `if (quota < 10000)`. Current bucket sizes are provider config.
- **Buckets (reference, 2026-09-15):** 10k/day general (videos.list/channels.list/videoCategories/liveBroadcasts/liveStreams) each 1; **100/day search.list (1 each)** + 100/day videos.insert (1 each). Separate buckets.
- **ETag:** `If-None-Match` → `304 Not Modified` zero-cost per https://developers.google.com/youtube/v3/getting-started#etags — cache to save quota.
- **Gzip:** `Accept-Encoding: gzip`.
- **First scaling constraint is general 10k quota** — 300 channels at 15m poll = 28.8k videos.list/day >10k → use 60m poll + ETag + PubSubHubbub hints.

## Events

- **PubSubHubbub (WebSub)** per https://developers.google.com/youtube/v3/guides/push_notifications: `POST https://pubsubhubbub.appspot.com/subscribe` with `hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...`, `hub.callback`, verify `hub.challenge` echo. Atom `<entry>` has `<yt:videoId>` + `<yt:channelId>` — **hint, not EventSub**; re-fetch `videos.list` to canonicalize.
- No `stream.online` webhook like Twitch — PubSubHubbub + polling `videos.list` is primary; `search.list` not for polling.

## Limitations

- **Tags:** `snippet.tags[]` freeform vs Twitch curated `tag_id` — need `CanonicalTag` with `source` discriminant → `required_youtube_tags` not `required_twitch_tag` (MULTI-PLATFORM.md:4).
- **Discovery:** `videos.list` requires known `videoId`; PubSubHubbub or `search.list` (100/day cap) is discovery — do not assume `videos.list` alone polls live.
- **Pagination:** `pageToken`/`nextPageToken` only for `myRating`/`chart` modes; `id` mode not paginated — https://developers.google.com/youtube/v3/docs/videos/list

## Version Check

Verify before implementing: `https://developers.google.com/youtube/v3/docs/videos/list` `part`/`snippet` fields, `https://developers.google.com/youtube/v3/determine_quota_cost` bucket table, `https://developers.google.com/youtube/v3/guides/push_notifications`.
