# Sponsor Sentinel — Domain

> **Update SENTINEL-01B (hardened, revalidated 2026-09-30):** Core domain is platform-agnostic via `ConnectedChannel` with `connection_mode` (`discovered` vs `authorized`), `CanonicalCategory`/`CanonicalTag` (no `game_name`), small capability interfaces + separated event pipeline. See `MULTI-PLATFORM.md` for matrix and decisions. This doc remains valid with multi-platform notes.

---

## 1. Problem

Esports orgs sign sponsor contracts with deliverables like “player must stream title containing `#OurBrand` + tag `SponsorCup` for 2h in March.” Managers currently screenshot streams manually to prove compliance. No system proves `contract → observed evidence → evaluation → result` deterministically or preserves audit trail for sponsor disputes.

Sentinel solves narrowly: **store requirement → collect observable platform metadata (Twitch/YouTube/Kick via provider adapters → `CanonicalLiveStream`/`CanonicalVideo`/`CanonicalCategory`/`CanonicalTag`) → evaluate (five states) → preserve evidence → report**. It does not read minds, contracts, or video frames.

## 2. Users

- **Primary:** Org manager / owner (`role=owner/admin` `supabase/migrations/20250930000001_initial_schema.sql:89`) creates campaigns/deliverables, connects **platform** channels (Twitch/YouTube/Kick), reviews compliance.
- **Secondary:** Sponsor (report consumer — via shared report link, not app user).
- **Not user:** Streamer (no login needed for MVP; channel is identified by handle → platform `external_channel_id` via provider `ChannelResolver` — Twitch `Get Users`, YouTube `channels.list`, Kick `Get Channels`). MVP channels are `connection_mode=discovered` (public verification), not `authorized` (OAuth grant) — see `MULTI-PLATFORM.md:3`.

## 3. Scope (MVP)

**In (multi-platform, but smallest useful):**
- Register **ConnectedChannel** per org with `platform` enum (`twitch`/`youtube`/`kick`) — `login/handle/slug` → `external_channel_id` via provider `ChannelResolver` (Twitch `Get Users`, YouTube `channels.list`, Kick `Get Channels`) — `connection_mode=discovered` (MVP), `authorized` is future — see `MULTI-PLATFORM.md:3/7`.
- Create Sponsor Campaign with window (`starts_at`, `ends_at`) per org.
- Define typed deliverable rules — **platform-neutral** (`required_title_contains`, `required_hashtag`, `required_category` with `CanonicalCategory.categoryId`, `required_streaming_window`) and **platform-scoped** (`required_twitch_tag` `source:twitch_curated` vs `required_youtube_tags` `youtube_freeform` vs `required_kick_tags` `kick/kick_custom` yielding `CanonicalTag[]`, `minimum_duration` Twitch/YouTube only, `required_vod_exists` not Kick) — validated per `platform` via `getCapabilities()`; unsupported → `NOT_SUPPORTED` (see `EVIDENCE-MODEL.md` + `MULTI-PLATFORM.md:9`).
- Monitor configured channels via provider adapters: Twitch poll `Get Streams`/`Get Channel Information`/`Get Videos` with App Token (800/min, `ProviderBudget`); YouTube `channels.list` + `videos.list` id-based with API key (1 inside 10k, PubSubHubbub hint, `search.list` 100/day cap avoided for polling) + `videoCategories.list`; Kick `Get Livestreams`/`Get Channels` with app token — see `MULTI-PLATFORM.md` and provider skills.
- Collect immutable evidence records (`platform`, `source` `youtube_*/kick_*`/`event`, `observed_value` etc. — see `EVIDENCE-MODEL.md:2`).
- Evaluate deterministically → `PASS`/`FAIL`/`NOT_VERIFIABLE`/`PENDING`/`NOT_SUPPORTED` (five, not boolean).
- Preserve audit history; generate sponsor-proof report (campaign → deliverables → evidence → evaluation per platform).

**Non-goals (explicitly out):**
- Sponsorship CRM / contract management / AI contract reader.
- Team management, social-media, analytics dashboard.
- Video/audio content analysis (spoken mentions, logo overlays) — **NOT MVP-OBSERVABLE** `TWITCH-CAPABILITIES.md:Matrix`.
- Chat, clips, moderation, ad scheduling, prediction/polls.
- Billing, Discord automation (foundation stubs only `src/server/integrations/`).
- OAuth for private videos (`liveBroadcasts`/`liveStreams`) — future.

## 4. Vocabulary (ubiquitous language)

- **Campaign** — Sponsor deal for org, with window and deliverables. Not Twitch campaign.
- **Deliverable** — Single contractual requirement, expressed as **typed rule(s)** (`DeliverableRule` union, not `condition:string`).
- **Rule** — Typed predicate (`RequiredTitleContains{value}`, not `condition:string`). Category rule uses `categoryId` → `CanonicalCategory` (no `game_name` in generic).
- **ConnectedChannel** — `platform` (`twitch`|`youtube`|`kick`) + `external_channel_id` + `external_handle` + `canonical_url` + `connection_mode` (`discovered`|`authorized`) + `connection_status` owned by org — replaces `TwitchChannel` (see `MULTI-PLATFORM.md:3`).
- **Evidence** — Immutable snapshot from provider → `CanonicalLiveStream`/`CanonicalVideo` (`source=get_streams` etc., `observed_value="title: #OurBrand Cup"`). See `EVIDENCE-MODEL.md`.
- **Evaluation** — Deterministic `rule + canonical evidence → result` (`PASS`/`FAIL`/`NOT_VERIFIABLE`/`PENDING`/`NOT_SUPPORTED`) — evaluator imports only canonical, never provider.
- **Scan** — One `DISCOVER→FETCH→NORMALIZE→EVALUATE→PERSIST EVIDENCE→PERSIST EVALUATION→PERSIST SCAN` cycle for a channel (platform-agnostic).
- **Report** — Evidence-based proof (not live DB view) for sponsor.
- **Platform** — `twitch` | `youtube` | `kick` enum.
- **Provider Adapter** — Translates Helix / Data API / Kick API → `Canonical*` via `mappers.ts` (`src/server/integrations/{twitch,youtube,kick}/`). Small capability interfaces only (see `MULTI-PLATFORM.md:4`).
- **ProviderBudget** — Abstraction for rate/quota (Twitch token bucket, YouTube quota buckets + ETag, Kick 429) — no hard-coded 10_000 in business logic.

## 5. Entities & Relationships (multi-platform, 01B hardened)

```
Organization — existing `public.organizations` (foundation)

Organization 1—N ConnectedChannel
ConnectedChannel { id uuid PK, organization_id FK, platform enum('twitch','youtube','kick'), external_channel_id text, external_handle text, display_name, canonical_url, connection_mode enum('discovered','authorized') default 'discovered', connection_status enum('connected','disconnected','expired','revoked') default 'connected', authorized_at timestamptz|null, metadata jsonb, created_at, updated_at } — replaces TwitchChannel. Unique(organization_id, platform, external_channel_id). See MULTI-PLATFORM.md:3/10.

Organization 1—N SponsorCampaign
SponsorCampaign { id uuid PK, organization_id FK, name, sponsor_name, starts_at, ends_at, created_at } — platform-agnostic, may span multiple ConnectedChannels.

SponsorCampaign 1—N Deliverable
Deliverable { id uuid PK, campaign_id FK (→ org via campaign), title, rules: jsonb (DeliverableRule[] platform-neutral + platform-scoped, validated against getCapabilities()), created_at }

Deliverable 1—N Evidence (per scan, per platform)
Evidence { id uuid PK, deliverable_id FK, campaign_id FK, organization_id FK, platform enum, external_channel_id, external_content_id, evidence_type enum(live_stream|video), source enum (get_streams|get_videos|get_channel_info|get_stream_tags|get_games|youtube_channels_list|youtube_videos_list|youtube_search_list|kick_livestreams|kick_channels|event), source_id, observed_at timestamptz, observed_value text, normalized_value text, raw_ref jsonb ({id/url}), scanner_version text, source_url }

Evidence 1—1 Evaluation (immutable, versioned)
Evaluation { id uuid PK, evidence_id FK, deliverable_id FK, platform enum, rule_type, result enum (PASS|FAIL|NOT_VERIFIABLE|PENDING|NOT_SUPPORTED), reason text, evaluated_at }

Scan { id uuid PK, organization_id FK, connected_channel_id FK, platform enum, started_at, finished_at, status enum (success|partial|failed), idempotency_key unique sha256(org+channel+campaign+window) }

Report (derived, not stored long) = Campaign + Deliverables + latest Evidence (per platform) + Evaluations + scan metadata
```

**Ownership strategy (multi-tenancy):** Every table has `organization_id` direct (or via `campaign_id→organization_id` for Deliverable/Evidence with denormalized `organization_id` for RLS simplicity). RLS `using (is_org_member(organization_id))` `supabase/migrations/20250930000002_rls.sql:1`. Indirect ownership not used — direct makes RLS trivial and prevents join-bypass.

**Why these entities, why not more:** `TwitchChannel` separate from `Organization` because org may monitor 5 channels; `SponsorCampaign` not just `Deliverable` because deliverables share window and report together; `Evidence` + `Evaluation` split per critical principle `requirement → evidence → evaluation → result`; `Scan` tracks idempotency/retry; no `Sponsor` table — `sponsor_name` string in `Campaign` suffices for narrow scope.

## 6. Lifecycle (multi-platform, 01B: discovered vs authorized + separated events)

```
Manager: Connect Platform Channel — select Twitch/YouTube/Kick → handle → ChannelResolver (Get Users / channels.list / Get Channels) → store ConnectedChannel (platform, external_channel_id, canonical_url, connection_mode=discovered) — see MULTI-PLATFORM.md:3/7

Manager: Create Campaign (name, sponsor_name, window) — platform-agnostic

Manager: Add Deliverable(s) — UI shows supported capabilities per ConnectedChannel.platform via getCapabilities(); typed rules Zod validated; unsupported rule rejected per platform (NOT_SUPPORTED → message)

System: Scan (cron DISCOVER per ConnectedChannel → adapter FETCH LiveState/VideoEvidence via ProviderBudget + ETag/cache → mappers NORMALIZE → Canonical → evaluator EVALUATE (five states, never provider import) → PERSIST EVIDENCE + EVALUATION + SCAN, idempotent by (channel, campaign, source_id))

Manager: Review Evidence (why PASS/FAIL/NOT_SUPPORTED — observed_value + normalized + timestamp + source_url per platform)

Manager: Generate Report (campaign → deliverables → per-platform latest evidence → evaluations, shareable)

System (future, not MVP): Provider Event (Twitch EventSub stream.online via EventVerifier→Parser→Normalizer→Ingestor, YouTube PubSubHubbub Atom hint → re-fetch videos.list → canonical, Kick livestream.metadata via RSA verifier) + Cron reconciliation (duplicate safe, new Evidence version, not mutate old)

Manager: Edit Deliverable after evaluation → new Evaluation version, old preserved (audit)
```

**Invariants:**
- `Deliverable.rules` is `jsonb` array of discriminated union, Zod validated, extensible, not `condition:string`. `required_category` uses `categoryId` (not `game_name`).
- `Evidence` immutable — never update `observed_value`; new scan creates new row. Old `Evaluation` preserved. `CanonicalTag` discriminant preserved.
- Same `evidence + rule` → same `result` (deterministic normalization). Evaluator never imports `twitch`/`youtube`/`kick`.
- `connection_mode=discovered` suffices for MVP public reads; `authorized` only for future private (`liveBroadcasts`/`channel:write`) — not equated.

## 7. Authorization Flow (canonical)

```
authenticated user → requireOrganizationContext(orgSlug) → is_org_member + role → requireEntitlement(orgId, "sponsor-sentinel") → domain operation (createCampaign, addDeliverable, triggerScan)
```

Never `client sends organizationId → trust`. See `ARCHITECTURE.md` §6 and `.agents/skills/security/SKILL.md`.

## 8. Scale & Extensibility

- **1000 orgs:** No redesign — `organization_id` indexed, RLS per row, `tools` catalog already supports `sponsor-sentinel` slug. New microtool adds its own tables under `features/<slug>/` without touching this model.
- **Rule extensibility:** Add new `DeliverableRule` variant (e.g., `RequiredViewerCount`) → add Zod schema, evaluator case, test — no migration for `Deliverable` (rules jsonb). Evidence model unchanged.
- **Next platform:** New `Platform` value + `ConnectedChannel` check + adapter (`ChannelResolver`/`LiveStateProvider`/etc.) + `getCapabilities()` — no `SponsorCampaign`/`Deliverable` rewrite.
