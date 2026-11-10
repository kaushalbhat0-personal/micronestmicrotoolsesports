# Sponsor Sentinel — Evidence Model

> **Update SENTINEL-01B (hardened, revalidated 2026-09-30):** Platform-agnostic evidence via `Canonical*` observations; five evaluation states; `CanonicalCategory`/`CanonicalTag` (no `game_name` in generic). See `MULTI-PLATFORM.md:5/9/13`.

> **Critical principle:** `Contractual requirement → Observable evidence → Evaluation → Compliance result` — never collapse to one boolean.

---

## 1. Observable Evidence (platform metadata only)

**Observable (MVP) per platform — see `MULTI-PLATFORM.md:1`:**
- **All platforms (Twitch/YouTube/Kick):** `title`, `CanonicalCategory`, `CanonicalTag[]`, `started_at`, live presence.
- **Twitch/YouTube only:** `description` (Twitch VOD `Get Videos.description`, YouTube `snippet.description`; Kick only `channel_description` — treat live description nullable/unknown `KICK-CAPABILITIES.md:3`), `duration` (Twitch `"2h..."` + YouTube `PT...`, Kick NOT_SUPPORTED), `VOD existence/URL` (Twitch/YouTube, Kick **NOT_SUPPORTED** — no `Get Videos`).
- **Tags semantics differ:** Twitch curated `tag_id` (`Get Stream Tags` → `source: twitch_curated`), YouTube freeform `snippet.tags[]` (`youtube_freeform`), Kick `tags[]`+`custom_tags[]` (`kick`/`kick_custom`) — `CanonicalTag[]` discriminant preserves difference; evaluator uses platform-scoped rules.

**Not observable (any Helix/Data API):** Spoken mentions, on-screen logos, chat hashtags, raw video/audio — would need ASR/CV and VOD download, not free-tier. Marked `NOT MVP-OBSERVABLE` / `NOT_SUPPORTED` for Kick VOD (MULTI-PLATFORM.md:2).

## 2. Evidence Record (immutable, auditable)

```ts
// src/features/sponsor-sentinel/types.ts (future) — multi-platform, 01B hardened
interface Evidence {
  id: string;
  organization_id: string; // denormalized for RLS
  deliverable_id: string;
  campaign_id: string;
  platform: "twitch" | "youtube" | "kick";
  external_channel_id: string;
  external_content_id: string | null; // stream/video id per platform
  evidence_type: "live_stream" | "video";
  source: "get_streams" | "get_channel_info" | "get_videos" | "get_stream_tags" | "get_games"
        | "youtube_channels_list" | "youtube_videos_list" | "youtube_search_list" | "youtube_video_categories"
        | "kick_livestreams" | "kick_channels" | "event"; // 01B: youtube_/kick_ prefixes + event
  source_id: string;
  observed_at: string; // RFC3339 — proves timing vs campaign window, not scan time
  observed_value: string; // raw
  normalized_value: string; // lower+trim+collapse
  raw_ref: { external_id: string; url?: string; viewable?: string; platform: Platform }; // minimal, not full dump
  source_url: string | null; // https://twitch.tv/videos/... | https://youtube.com/watch?v=... | https://kick.com/... 
  scanner_version: string;
  rule_type: string; // denormalized for evaluator trace
}
```

**Fields why:**
- `source`/`source_id`/`raw_ref.url` — answers “where did you see it? Twitch link”.
- `observed_value` vs `normalized_value` — preserves why evaluation passed (raw) and how it was compared (normalized) — audit.
- `observed_at` — proves timing vs campaign window, not scan time.
- `raw_ref` minimal — not full Helix payload (cost), just id/url needed to re-verify. Store full payload only if required for dispute, with retention policy.
- Immutable — new scan → new row, old preserved for “why did you say FAIL last week?”.
- `platform` + `external_channel_id` + `evidence_type` — multi-platform audit + tenant isolation.

**What not persisted:** Full Helix/YouTube/Kick JSON, derived `result` (stored in `Evaluation` separate).

## 3. Rule Model (typed, extensible) — hardened 01B

```ts
// Discriminated union, Zod-validated — platform-neutral vs platform-scoped (see MULTI-PLATFORM.md:9)
type DeliverableRule =
  // Platform-neutral (all support title/hashtag/category/window — but check capability)
  | { type: "required_title_contains"; value: string }
  | { type: "required_hashtag"; value: string } // normalized to "#ourbrand" in title
  | { type: "required_category"; categoryId: string; platform?: Platform } // 01B: categoryId (not game_id) → CanonicalCategory.id
  | { type: "required_streaming_window"; } // domain only, no provider read
  // Platform-scoped (tags semantics differ → CanonicalTag source discriminant)
  | { type: "required_twitch_tag"; tag_id: string } // curated, source twitch_curated
  | { type: "required_youtube_tags"; tags: string[] } // freeform snippet.tags, normalized lower, match semantics documented (any|all)
  | { type: "required_kick_tags"; tags: string[] } // tags/custom_tags mixed
  // VOD-dependent (Kick NOT_SUPPORTED — see MULTI-PLATFORM.md)
  | { type: "minimum_duration"; minutes: number } // Twitch + YouTube only → ProviderCapabilities.supportsDuration
  | { type: "required_vod_exists"; } // Twitch + YouTube only
  | { type: "required_description_contains"; value: string } // Twitch VOD / YouTube yes, Kick NOT_SUPPORTED

// Deliverable.rules: DeliverableRule[] (AND semantics: all must PASS; per-platform evaluation yields NOT_SUPPORTED if platform lacks capability)
```

**01B change:** `required_category game_id` → `categoryId` referencing `CanonicalCategory.id` (not `game_name`). `Get Games` name→id resolution lives inside Twitch mapper, not generic rule.

**Why typed, not `condition:string`:** Type-safe, exhaustive switch in evaluator, junior-readable, extensible without migration (jsonb). Avoid `regex` unless genuine requirement — use `contains` with normalization first.

**Good:** `{ type: "required_hashtag", value: "#OurBrand" }` — explicit, testable.
**Bad:** `{ condition: "title includes hashtag" }` — stringly-typed, not exhaustive, AI-like.

## 4. Evaluation States (not boolean) — five

```ts
type EvaluationResult = "PASS" | "FAIL" | "NOT_VERIFIABLE" | "PENDING" | "NOT_SUPPORTED";
```

| State | When | Technical failure? |
|-------|------|-------------------|
| **PASS** | Evidence proves compliance | — |
| **FAIL** | Evidence proves non-compliance (capability exists, observation available) | Never for 429/503 |
| **NOT_VERIFIABLE** | Platform supports capability but this observation cannot prove (VOD deleted, channel renamed, empty description, 429/503) | Yes — transient → NOT_VERIFIABLE/PENDING |
| **PENDING** | Not yet scanned or VOD delayed (`Get Videos` empty right after `stream.offline`) | Yes — retry next cron |
| **NOT_SUPPORTED** | **Platform fundamentally cannot provide capability** (e.g., `required_vod_exists` on Kick — no VOD endpoint per `KICK-CAPABILITIES.md:3`; `minimum_duration` on Kick) | Never transient — reject at creation validation per `MULTI-PLATFORM.md:9` |

Do **not** use `compliant: boolean` — `PENDING`/`NOT_VERIFIABLE`/`NOT_SUPPORTED` ≠ `FAIL`. See `MULTI-PLATFORM.md:13` for distinction. Malicious payload / malformed Helix → `NOT_VERIFIABLE` with reason `validation_failed`, not `FAIL`.

## 5. Normalization (explicit, deterministic)

Same `evidence + rule` → same `result` always. Define before implementing evaluator.

- **Case:** `toLowerCase()` per Unicode `en` (e.g., `#OurBrand` → `#ourbrand`) — checked via `normalized_value`.
- **Whitespace:** `trim()` + collapse `\s+` → ` ` (e.g., `"  #OurBrand  CUP  "` → `"#ourbrand cup"`).
- **Hashtag:** Ensure leading `#` normalized: `value.trim().toLowerCase().replace(/^#?/,"#")` → `#ourbrand`.
- **Title matching:** `contains` semantics: `normalized_title.includes(normalized_value)` — not exact, not regex. Document per rule.
- **Tag:** `CanonicalTag` exact match — Twitch `tag_id` exact; YouTube/Kick freeform lower-exact. Not substring.
- **Category:** Exact `categoryId` (`CanonicalCategory.id`) match — resolve `game_name`→id inside Twitch mapper only.
- **Duration:** Parse `"2h34m12s"` → minutes `154` via `/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/`, and `PT1H2M3S` → `3723s`; compare `minutes >= required` or `seconds >= minutes*60`.
- **Not yet:** Unicode NFKC, emoji — only if needed; keep MVP simple.

Every rule documents its normalization. No hidden heuristics, no AI scoring.

## 6. Auditability

Evidence answers “Why did you say PASS/FAIL/NOT_SUPPORTED?”:

```
Deliverable: required_hashtag #OurBrand
Evidence: source=youtube_videos_list, source_id=VIDEO_ID, observed_at=2026-03-10T14:00:00Z,
  observed_value="EPIC #OurBrand CUP !", normalized="epic #ourbrand cup !",
  raw_ref={external_id:"VIDEO_ID", url:"https://youtube.com/watch?v=VIDEO_ID", platform:"youtube"},
  platform=youtube, evidence_type=video
Evaluation: PASS, rule_type=required_hashtag, evaluated_at=..., reason="normalized title contains #ourbrand"
---
Deliverable: minimum_duration 120m on Kick
Evaluation: NOT_SUPPORTED, reason="Kick no VOD endpoint — duration not observable (KICK-CAPABILITIES.md:3)"
```

Report links `raw_ref.url`/`source_url` for sponsor to verify. Old evidence/evaluations never mutated — new scan creates new version, report shows latest but history preserved.

## 7. Checklist

- [ ] Did I store `platform` + `external_channel_id` + `evidence_type` + `source` (with youtube_/kick_ prefixes) + `observed_at` + `observed_value`/`normalized_value`?
- [ ] Is rule typed union with `categoryId` (not `game_name`), Zod-validated, not `condition:string`, and validated against `getCapabilities()`?
- [ ] Five states, not boolean — `PENDING`/`NOT_VERIFIABLE`/`NOT_SUPPORTED` never mapped to `FAIL`?
- [ ] `CanonicalTag` source discriminant used, not `string[]`?
- [ ] Normalization explicit and tested per rule?
