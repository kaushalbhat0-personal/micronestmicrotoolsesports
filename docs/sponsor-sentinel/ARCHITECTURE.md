# Sponsor Sentinel — Architecture

> **Implementation contract for next RCCF — hardened 01B (revalidated 2026-09-30).** No scanner/cron/webhook/report UI is built in this doc — this is the blueprint. See `MULTI-PLATFORM.md:6/10` for scan flow + DB contract.

---

## 1. Domain Boundaries

```
src/features/sponsor-sentinel/
├── components/    # Tool UI (campaign/deliverable/evidence/report) — pages compose
├── schemas/       # Zod: DeliverableRule (categoryId, CanonicalTag), Campaign, ConnectedChannel (connection_mode)
├── services/      # Pure: evaluator (deterministic, five states, no provider import), report builder
├── repositories/  # DB: campaigns, deliverables, evidence, evaluations, scans, connected_channels
├── types/         # Domain types: CanonicalLiveStream, CanonicalVideo, CanonicalCategory, CanonicalTag, Evidence, EvaluationResult
└── index.ts       # Public barrel (only export via this)

src/server/integrations/{twitch,youtube,kick}/
├── client.ts      # ChannelResolver + LiveStateProvider + VideoEvidenceProvider + CategoryProvider + TagProvider + ProviderBudget
├── types.ts       # Provider Helix/Video/Kick shapes (not leaked)
├── mappers.ts     # Provider → Canonical* (pure, tested)
└── budget.ts      # ProviderBudget (Twitch Ratelimit-Remaining/Reset, YouTube ETag/Quota buckets, Kick 429) — not rate-limit.ts only

src/server/repositories/  (future)
├── connected-channels.ts
├── sponsor-campaigns.ts
├── deliverables.ts
├── evidence.ts
└── scans.ts

src/server/services/ (future)
├── campaign-service.ts
└── scan-orchestrator.ts // DISCOVER→FETCH→NORMALIZE→EVALUATE→PERSIST* — platform-agnostic

lib/auth/ — already: requireOrganizationContext, requireEntitlement("sponsor-sentinel")
```

**Rule:** `features/sponsor-sentinel/services/evaluator.ts` depends on `Canonical*` (`types.ts` + `mappers.ts` output), never on raw Helix/`videos.list`/Kick `livestreams` shape. No `any`, no `game_name` in generic. Vendor detail isolated.

## 2. Data Flow

```
Manager: POST /dashboard/[orgSlug]/sponsor-sentinel/campaigns (Server Action)
  → requireOrganizationContext(orgSlug) → requireEntitlement(orgId,"sponsor-sentinel")
  → parseOrThrow(createCampaignSchema) (Zod) → campaign-service.create → repository → redirect

Manager: Add channel (select platform → handle → ChannelResolver) → resolve external_channel_id → store connected_channels (connection_mode=discovered)

Scan (future, not built — see MULTI-PLATFORM.md:6):
  Vercel Cron / Event webhook
  → assertCronAuth OR EventVerifier.verify (Twitch HMAC / Kick RSA / YouTube hub.challenge)
  → EventParser.parse → EventNormalizer.normalize → EventIngestor.ingest (→ evaluator) OR scan-orchestrator
  → for each channel via ProviderBudget: adapter getLiveState/listVideos/listTags/resolveCategory (batch, pagination cursor/pageToken/next_cursor, ETag If-None-Match)
  → mappers.normalize → CanonicalLiveStream/CanonicalVideo/CanonicalTag/CanonicalCategory
  → evaluator (rule+canonical → PASS/FAIL/NOT_VERIFIABLE/PENDING/NOT_SUPPORTED — exhaustive switch, never provider)
  → repositories persist Evidence (immutable) + Evaluation + Scan (idempotency_key)
  → report reads Evidence+Evaluations (not live provider)

Report: GET /dashboard/[orgSlug]/sponsor-sentinel/campaigns/[id]/report → requireOrganizationContext → requireEntitlement → reportBuilder (Evidence+Evaluations → summary + provider links) → Card/Table UI
```

## 3. Scan Lifecycle (future, idempotent, retry-safe) — plus separated events

```
DISCOVER → FETCH → NORMALIZE → EVALUATE → PERSIST EVIDENCE → PERSIST EVALUATION → PERSIST SCAN
  └─ Cron reconciler (authoritative) + Event pipeline (verify→parse→normalize→ingest) as hint
```

| Step | Details | Idempotency / Failure |
|------|---------|----------------------|
| **DISCOVER** | Cron lists `connected_channels where organization_id` + `campaigns where window includes now` OR event provides `external_channel_id` + `yt:videoId`/`streamId` | N/A — Cron is reconciler |
| **FETCH** | Provider `getLiveState` / `listVideos?user_id` / `listTags` / `resolveCategory` — batched `user_id` repeated, `first` 100 / `limit` 1000 / `pageToken`, ETag `If-None-Match` → 304 zero-cost (YouTube) | Retry on 429/503 via `ProviderBudget`, not fail deliverable; dedupe by `source_id`; 304 uses cache |
| **NORMALIZE** | `mappers.ts`: `title`→`normalized_value` (lower+trim+collapse), `duration` `"2h..."`→seconds + `PT...`→seconds, `CanonicalCategory` via `Get Games`/`videoCategories`, `CanonicalTag` with `source` | Deterministic, pure, tested |
| **EVALUATE** | `services/evaluator.ts`: exhaustive `switch(rule.type)` → five states per `EVIDENCE-MODEL.md:4` — **no provider import** | Same evidence+rule → same result; `NOT_SUPPORTED` for Kick VOD/duration |
| **PERSIST EVIDENCE** | `evidence.ts` insert `platform`, `external_channel_id`, `external_content_id`, `evidence_type`, `source` (`youtube_videos_list` etc.), `observed_value/normalized/raw_ref/scanner_version/source_url`, never update | `on conflict do nothing` via `scans.idempotency_key = sha256(org+channel+source_id+rule_version)` |
| **PERSIST EVALUATION** | `evaluations` linked to `evidence_id`, `platform`, `result` five states | Immutable; new evidence → new evaluation |
| **PERSIST SCAN** | `scans` row `idempotency_key = sha256(org+channel+campaign+windowStart)` unique, `status` | `on conflict do nothing` for duplicate cron/event |

**Stale / VOD delayed:** If `Get Videos`/`videos.list` empty right after `stream.offline`/`actualEndTime`, mark `PENDING`, retry next cron (15m). Do not `FAIL`.

**Re-scan:** Editing `Deliverable.rules` creates new `Evaluation` for existing `Evidence` (new version), old preserved.

## 4. EventSub / PubSubHubbub / Kick webhook vs Cron Decision — hardened

**MVP: Cron-only for all platforms; event subscriptions as enhancement — Cron remains authoritative reconciler.**

| Mechanism | Useful for | Auth / Cost / Tradeoff |
|-----------|------------|------------------------|
| **Cron** (`/api/cron/sentinel-scan`, Vercel Cron) | Reconciliation, VOD discovery, backfill, retry, periodic verification — reliable, $0, no public callback | Polling latency (15m default; YouTube 60m at scale), uses `ProviderBudget`; YouTube needs ETag + PubSubHubbub to stay within 10k quota |
| **Twitch EventSub** (`stream.online`/`offline`/`channel.update`) | Low latency (seconds), Twitch pushes | Requires public HTTPS `callback`, `secret`, **app token** (fails with user token), subscription per `broadcaster_id`, missed events if down, duplicates at-least-once, `webhook_events` dedupe + HMAC `Twitch-Eventsub-Message-Signature` + timestamp <10m — https://dev.twitch.tv/docs/eventsub/handling-webhook-events/ |
| **YouTube PubSubHubbub** (WebSub) | Near-realtime upload/title hint | `POST https://pubsubhubbub.appspot.com/subscribe` `hub.topic=https://www.youtube.com/xml/feeds/videos.xml?channel_id=UC...`, verify `hub.challenge` 10s; Atom `<yt:videoId>` is **hint** → must re-fetch `videos.list` (1 unit) — https://developers.google.com/youtube/v3/guides/push_notifications |
| **Kick webhook** (`livestream.metadata` etc.) | Title/category change push | `POST /events/subscribe-to-events`, verify `Kick-Event-Signature` RSA via `GET /public/v1/public-key` + `Message-Id` ULID + timestamp <10m — https://docs.kick.com/events/webhook-security.md |

**Why Cron first:** Event adds callback infra + secret/JWKS management + missed-event backfill anyway — Cron already needed for VOD delay/deletion. Cron-first keeps $0, simpler, deterministic. Add `SubscriptionManager`+`EventVerifier/Parser/Normalizer/Ingestor` per `MULTI-PLATFORM.md:6.2` in later RCCF as enhancement, keep Cron as reconciler (hybrid later). Do not choose Cron-only forever — document hybrid path.

**Future hybrid:** Event `verify→parse→normalize→ingest` for immediate; Cron every 15m (Twitch/Kick) or 60m (YouTube at scale) backfills missed, VOD, retries.

## 5. Rate / Quota Strategy — ProviderBudget abstraction (no hard-coded 10_000)

- **Twitch:** Bucket 800/min per `client_id` per https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits, cost 1. Track `Ratelimit-Remaining`/`Reset` in `budget.ts`, backoff on 429 until `Reset`, never `FAIL`. Batch `Get Streams?user_id=1&user_id=2` repeated param, `first=100`.
- **YouTube:** `ProviderBudget` with **general 10k bucket** (videos.list/channels.list/videoCategories/liveBroadcasts/liveStreams each 1) + **100/day search.list bucket (1 each)** + `If-None-Match` ETag → 304 zero-cost + `Accept-Encoding: gzip` per https://developers.google.com/youtube/v3/getting-started#etags. Avoid `search.list` polling. At 300 channels, use 60m poll + ETag to stay <10k — see `MULTI-PLATFORM.md:12`.
- **Kick:** Unknown → `ProviderBudget` generic 429 backoff with jitter + `Retry-After`, respect unknown `Ratelimit-*` if present.
- Technical 429/503/quota → `PENDING`/`NOT_VERIFIABLE`, not `FAIL`.

## 6. Integration Adapter (future) — small capability interfaces

```
src/server/integrations/twitch/
├── client.ts    // getAppToken + ChannelResolver/LiveStateProvider/VideoEvidenceProvider/CategoryProvider/TagProvider + TwitchBudget
├── types.ts     // TwitchStream { id, title, tags, game_name → CanonicalCategory.id } etc. (not leaked)
├── mappers.ts   // mapStreamToCanonicalLiveStream(stream): CanonicalLiveStream { category: CanonicalCategory, tags: CanonicalTag[] }
└── budget.ts    // TwitchBudget implements ProviderBudget

src/server/integrations/youtube/
├── client.ts    // API key + OAuth future, channels.list/videos.list/search.list, YouTubeBudget with ETag cache
├── types.ts
├── mappers.ts   // snippet+contentDetails+liveStreamingDetails → CanonicalVideo/LiveStream + CanonicalTag youtube_freeform
└── budget.ts

src/server/integrations/kick/
├── client.ts    // App token PKCE, Get Livestreams/Channels/Categories, KickBudget generic
├── types.ts
├── mappers.ts   // title/category/tags → Canonical* + CanonicalTag kick/kick_custom
└── budget.ts
```

`features/sponsor-sentinel/services/evaluator.ts` imports only `Canonical*` — never `TwitchStream`/`YouTubeVideo`/`KickLivestream`.

## 7. Future API / UI Routes (stubs exist for org context)

**API (future, not in this doc's implementation):**
- `POST /api/cron/sentinel-scan` — Bearer `CRON_SECRET` via `assertCronAuth`, calls `scan-orchestrator`, idempotent
- `POST /api/webhooks/twitch` — `EventVerifier` (HMAC) + `EventParser` + dedupe `webhook_events` → `EventIngestor`
- `POST /api/webhooks/youtube` — `hub.challenge` + Atom parse → `videos.list` enrich → ingest
- `POST /api/webhooks/kick` — `EventVerifier` RSA via `public-key` → parser → ingest
- `POST /api/subscriptions/{twitch,youtube,kick}` — `SubscriptionManager.subscribe/list/renew` (admin)

**UI (future, under `src/app/(dashboard)/dashboard/[orgSlug]/sponsor-sentinel/`):**
- `/dashboard/[orgSlug]/sponsor-sentinel` — stub exists `src/app/(dashboard)/dashboard/[orgSlug]/sponsor-sentinel/page.tsx:1` (already requires org context + entitlement) — expand to list campaigns + channel connect
- `/dashboard/[orgSlug]/sponsor-sentinel/channels` — connect channel (platform select → handle → ChannelResolver → `connected_channels` `discovered`)
- `/dashboard/[orgSlug]/sponsor-sentinel/campaigns/new` — create campaign (Zod, window)
- `/dashboard/[orgSlug]/sponsor-sentinel/campaigns/[id]` — campaign + deliverables + evidence list (observed_value + normalized + reason + provider link)
- `/dashboard/[orgSlug]/sponsor-sentinel/campaigns/[id]/report` — sponsor-proof report (not analytics) — `Campaign → Deliverables → Evidence (per platform) → Evaluation (PASS/FAIL/NOT_SUPPORTED)` summary

## 8. Security & RLS — hardened (see MULTI-PLATFORM.md:11)

- **AuthZ flow:** `authenticated → requireOrganizationContext(orgSlug) → requireEntitlement(orgId,"sponsor-sentinel") → repository` — see `security` skill. Never `?organizationId=` client trust.
- **RLS (new tables):** Every new table (`connected_channels`, `sponsor_campaigns`, `deliverables`, `evidence`, `evaluations`, `scans`) has `organization_id uuid not null` + `enable row level security` + policy `using (is_org_member(organization_id))` `supabase/migrations/20250930000002_rls.sql:1` + helper `is_org_member`. `webhook_events` expands to `provider in ('stripe','razorpay','twitch','discord','youtube','kick')` with `provider_event_id` unique. No `SECURITY DEFINER` on tables, only helpers.
- **ConnectedChannel mode:** `connection_mode` `discovered` (MVP) vs `authorized` (future OAuth) — do not equate; `authorized_at` nullable; `connection_status` `connected|disconnected|expired|revoked`.
- **Webhook/Event verification:** Twitch HMAC per `handling-webhook-events` + timestamp <10m + `message_id` dedupe; YouTube `hub.challenge` + re-fetch; Kick RSA via `public-key` + `Message-Id` ULID + timestamp <10m — via `EventVerifier`.
- **Service role:** Only `src/lib/supabase/admin.ts` for cron/webhook dedupe; never client.
- **Untrusted provider payloads:** Validate Zod before mapper, store `raw_ref` minimal, escape URLs/titles in report (XSS).

## 9. Failure Handling — five states, never technical→FAIL

- **Twitch 429/YouTube quota/Kick 429/503:** `ProviderBudget` backoff, `PENDING`/`NOT_VERIFIABLE` with reason `rate_limited until Reset` / `quota_exhausted` / `retry_at` — report shows reason, not `FAIL`.
- **Channel deleted/renamed:** Provider resolve → 0 results → `NOT_VERIFIABLE` + note "channel not found" (YouTube `videoNotFound`, Twitch 404).
- **VOD deleted/unavailable/delayed:** `Get Videos`/`videos.list` empty → `PENDING` until window closes → `NOT_VERIFIABLE` if still missing after window.
- **Kick VOD rules:** `NOT_SUPPORTED` immediately (no VOD endpoint) — reject at creation validation if possible.
- **Event missed/duplicated, cron duplicated:** `webhook_events` unique + `scans.idempotency_key` → `on conflict do nothing`, dedupe `Message-Id`/`Kick-Event-Message-Id`.
- **Deliverable edited after evaluation:** New `Evaluation` version, old preserved — report shows latest, history available.
- **Campaign ended, provider auth revoked:** App token 401 → refresh; future user token 401 → mark `NOT_VERIFIABLE` or `expired` status, not `FAIL`.

## 10. Zero-Cost — recalculated (see MULTI-PLATFORM.md:12)

- **Supabase free tier:** `Evidence` rows ~1 per deliverable per scan (15m cron × 5 channels × 30 days = ~14k rows/org/month; at 60m YouTube poll fewer) — within free; `raw_ref` minimal; retention 90 days future.
- **Vercel free tier + Cron:** `vercel.json` Cron free, `assertCronAuth` serverless — no paid queue.
- **Twitch free API:** App Token 800/min — batching keeps under. **YouTube free API** with `ProviderBudget` (ETag + 60m poll + PubSubHubbub) keeps under general 10k + 100/day search caps. **First scaling bottleneck is YouTube general 10k (not Twitch 800)** at 100 orgs/300 channels — mitigation is 60m poll + ETag + quota extension request (free, audit) — still $0 infra.
- **Storage:** No video bytes, only metadata + URLs.
