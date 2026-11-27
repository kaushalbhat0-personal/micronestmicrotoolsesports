# 04 — Growth and attribution audit

## Landing conversion (current)

| Element | Current | Campaign need |
| --- | --- | --- |
| Primary CTA | Sign up free (`/signup`) | Keep |
| Secondary CTA | Discover tournaments / explore players | Prefer **Create your BGMI identity card** / complete profile |
| Campaign URL | `/campaigns/bgmi-season` (noindex) | Identity-first FRAGIX landing; consider index when approved |
| Clarity of loop | Tools pathways dominate campaign page | Must state: register → ID → evidence → review → share |

## Analytics — existing vs proposed

### Existing (confirmed)

- **No** `gtag`, GTM, Plausible, PostHog, Segment, Mixpanel, or Vercel Analytics imports found under `src/`.
- Marketing/tools copy and tests actively avoid vanity “downloads / ratings” claims.
- Positioning includes “zero-telemetry” / “no commercial sale of player telemetry.”
- Share download is a client button with local status text only (`ShareDownloadButton`) — **no event sink**.

### Proposed (not implemented — do not ship silently)

| Metric | Proposed approach | Privacy rule |
| --- | --- | --- |
| Registrations | Count `auth.users` / `app_users` created in campaign window (ops SQL or privacy-safe product analytics) | No PII in dashboards shared externally |
| Profile completeness | Existing completeness helpers | Aggregate only |
| Evidence submitted / pending / approved | Case status counts | No evidence paths |
| PNG downloads | Opt-in first-party event or anonymous counter **without** handle in clear text if public | Never log BGMI ID / Storage URLs |
| Attribution | UTM on campaign links (`utm_source=instagram` etc.) parsed client-side into sessionStorage → signup metadata **only if** product allows non-sensitive `app_metadata`/`user_metadata` — **owner decision** | No fingerprinting |

Until instrumentation is explicitly approved, measure via:

1. Supabase Auth user growth (dashboard).
2. Case status histograms (service SQL, ops-only).
3. Manual social listening.

## Share → profile journey

- Watermark shows profile URL path/host — good for typed return traffic.
- No UTM baked into `profileUrl` today.
- No QR.

## Mobile performance (qualitative)

- App Router + dynamic player pages; Share Kit is client canvas (CPU on-device).
- Campaign/mobile evidence already captured (`campaign-mobile.png`).
- Risk: heavy homepage marketing sections; campaign landing should stay short (P0 recommendation in `05`).

## Priority

| Item | Priority | Reason |
| --- | --- | --- |
| Campaign CTA hierarchy → identity loop | P0 | Conversion |
| Decide analytics policy (keep zero-telemetry vs minimal first-party) | P0 | Avoid accidental tracking |
| UTM landing params (no PII) | P1 | Creative attribution |
| Download event (aggregate) | P1 | Loop health |
| Full product analytics suite | P2 | After brand launch |
