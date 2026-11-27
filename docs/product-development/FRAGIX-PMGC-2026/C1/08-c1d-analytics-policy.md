# 08 — C1D analytics policy (recommendation only)

**Status:** Recommendation — **not implemented**  
**Constraint:** No analytics SDK or instrumentation in this milestone

## Current instrumentation (facts)

| Check | Result |
| --- | --- |
| gtag / GTM / Plausible / PostHog / Segment / Mixpanel / Vercel Analytics in `src/` | **None found** |
| Share PNG download event sink | **None** — client-only canvas download |
| Campaign landing view tracking | **None** |
| Signup funnel events | **None** |
| Product positioning | “Zero-telemetry” / no commercial sale of player telemetry (marketing + tools) |

Until the owner explicitly chooses a policy, FRAGIX should remain **measurement-by-ops-SQL / Auth dashboard** only.

## Policy options (owner decision)

| Option | Meaning | Campaign fitness |
| --- | --- | --- |
| **A — Stay zero-telemetry** | No product events; measure via Auth growth + case status SQL + social listening | Allowed for controlled soft launch |
| **B — Minimal first-party aggregates** | Anonymous/coarse events below; no SDK that fingerprints by default | Preferred if measuring first 100 players |
| **C — Full product analytics suite** | Deferred (P2) | Out of scope for controlled launch |

**Do not ship Option B/C silently.** Requires disclosure update if any client-side tracker is introduced.

## Recommended event model (Option B — if approved)

Never include: passwords, BGMI Player IDs, evidence bytes/paths, signed URLs, internal reviewer notes, email, phone, IP as a product property (edge logs aside), free-text bios.

| Event | Trigger | Minimum properties | Exists today? | Consent / disclosure | Retention / access | PII-safe? |
| --- | --- | --- | --- | --- | --- | --- |
| `campaign_landing_view` | `/campaigns/bgmi-season` document load | `path`, `utm_source?`, `utm_medium?`, `utm_campaign?` (UTM only if present), `viewport_bucket` (mobile/desktop) | No | Disclose if client beacon; server log OK as aggregate | 90 days raw → weekly aggregates; ops only | Yes if no user id |
| `signup_started` | Signup form submit attempt (client) or Auth signUp call start | `surface` (`campaign` / `header` / `other`) | No | Account creation is expected; keep event anonymous until session exists | 90 days | Yes without email |
| `signup_completed` | Successful session after signup | `surface`; optional `day` bucket | No | Covered by account terms once published; still avoid email in event payload | 180 days aggregates | Prefer count-only ops SQL over client event |
| `player_profile_completed` | Completeness helper flips to complete | `game_key` (`bgmi`) only | No | Profile feature; disclose if tracked | 180 days | Yes without handle |
| `player_png_downloaded` | Share download success callback | `card_type` (`player`/`team`/`tool`); `ownership_badge` (`true`/`false`) | No | Disclose “anonymous download counts” if enabled | 90 days | Yes — **never** attach handle or profile URL in clear if shared externally |
| `public_profile_opened` | `GET` `/players/[handle]` success | `game_key`; **hash(handle)** optional or omit handle entirely | No | Public page; still prefer aggregate pageviews without handle | 90 days | Safer without handle |
| `registry_profile_discovered` | Directory search returns card click / profile open from `/players` | `from`=`registry`; `game_key` | No | Same as public profile | 90 days | Yes without PII |

### Preferred measurement without a client SDK (Option A+)

Ops-only SQL / dashboard (service-role, never published externally with PII):

1. New `app_users` / Auth users per day in campaign window.  
2. Profiles reaching completeness.  
3. Ownership cases by status (`pending_review`, `approved`, `rejected`, `id_mismatch`).  
4. Manual review SLA (time from `submitted_at` → decision).  

PNG downloads cannot be measured accurately without a product event or proxy — accept as **unknown** under Option A.

## Implementation gates (future — not C1D)

- Owner selects Option A or B in writing.  
- If B: update privacy disclosure before enablement; no evidence/ID properties in schema.  
- Prefer server-side aggregates over third-party pixels.  
- No LMS project analytics crossover.

## Analytics area verdict

**CONDITIONALLY READY** — product can soft-launch with Option A; funnel measurement for “first 100 players” is incomplete until Option B (or ops SQL + manual) is approved.
