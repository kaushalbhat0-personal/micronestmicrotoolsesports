# 07 — Preserved Domain Knowledge

Specs to keep after `ref/legacy-project/` deletion. Rules, not code. Prices are void and listed only to prevent accidental reuse.

## 1. Discovery / teams / opportunities

- Levels: 6-step `casual→community→competitive→higher-tier→semi-pro→professional`; self-reported; 1-below window (`meetsLevelMinimum`).
- Roles: per-title allowlists in code (BGMI: IGL/Assaulter/Support/Scout); new title = allowlist entry + additive CHECK; regions broad-only, `any/all/pan-india/online` compatible either side.
- Matching: hard filters (same game, `open`, `looking_for`, region, role∈{primary+secondary}, level window) then tier `strong(3)/good(≥1)/stretch/else no-match` over `targetAligned+overlap+trustSignal`; `labActivity` informational only; never percentages/scores.
- Fit reasons: 5 factual reasons max (`role/region/level/tryout/verification`), source-labelled (`Micronest verified` vs `Self-reported`).
- Handles/slugs: handle 3–20 `^[a-z0-9_]+$` lowercased; team slug 2–60 `^[a-z0-9]+(-[a-z0-9]+)*$`; no ownership takeover via update.
- Applications: partial unique `(post_id,applicant)` where `status∈{applied,shortlisted}`; withdraw `applied|shortlisted→withdrawn` owner-only; accept auto-adds `player` roster row (idempotent); shortlist never touches roster; cross-team isolation.
- Posts: captain-gated create/update/status; `slots` 1–10; `status open|paused|closed|filled`; `expires_at` default +30d; `created_by` session-derived.
- Reports: `target_type∈{player,team,recruitment_post,application}`, `target_id` uuid, reason 10–1000ch, `status open|reviewing|resolved|dismissed`.
- Masked projection: list only allowlisted columns; never `user_id/email/game_user_id/evidence/external_link/phone/address/timestamps`; Character ID masked `****+last4` where shown.
- Team logos: 512KB, png/jpeg/webp, fixed `{teamId}/logo.{ext}`, upsert, stale-variant cleanup best-effort.

## 2. Roster intake (pure)

- Caps: input 50k chars / 2000 lines / 300ch per line / 200 teams / 2000 players; capacity 1–30 (default 5).
- Identity: NFC + strip zero-width + collapse-ws + lower for keys; display preserves case/punct/diacritics; never conflate `Viper-OP≠Viper OP`, `José≠Jose`, `Rogue2≠Rogue`.
- Delimiters: tab/comma/semicolon/pipe, header-scored detect (tab tie-break); quote-aware for comma/semicolon only.
- Headers: ≥2 non-empty cells from TEAM/PLAYER/CONTACT vocabularies + ≥1 team|player; first wins; repeated skipped.
- Issues: blocking (missing-team/player per row, cross-team with team list, over-capacity with count/limit); review (exact dup, same-team spelling variants, team-name variants, malformed); info (single aggregates: extra-cols, too-long, empty-team). Sort blocking→review→info then line; `r<line>` refs; deterministic; never auto-merge.
- Slots: first-seen team order, line-order players, `slot=index+1` contiguous; moves clamp, no-op at edges.
- Output: `Team N — <team>` copy + `⚠ N unresolved` banner; CSV `Slot,Team,Player` with `'` guard for `^[=+@|-,\t]` + DDE words; WhatsApp budget 1500 with explicit truncation marker.

## 3. Tournament / news ingestion

- Validate-before-publish: all-or-nothing; failure writes only run row (`failed`), preserves published.
- Canonical scoring guard: table must equal `[10,6,5,4,3,2,1,1]+1/kill` or refuse ingest.
- Points: `matchTotal = placementPoints+finishes`; stage = `startingPoints + Σ completed`; rank `total→WWCD→placement→finishes→best-recent`.
- Rotation stage (if ever needed): bounded `1≤K≤N`, all-teams equal appearances, expected-map check.
- Observability: HTTP 200 + body `{ok,failed}` (gate on body, not status); `CRON_SECRET` Bearer; dual ledger (shared `cron_run_ledger` + per-run table); ledger writes best-effort; never echo secrets/unknown slugs in titles.
- Safe-fetch: HTTPS + exact-host allowlist + redirect recheck + timeout + size cap + UA; fail-closed to previous published.
- Meta revision: same `contentHash+parserVersion` → `unchanged` (zero writes); else `revised` (demote→replace→count-verify→promote); provisional `content_hash=""` + `ingested` never readable; backfill 1–5.
- Sanitizer: block-tags→space, strip tags, decode entities, drop controls, collapse-ws, slice 2000; never render raw HTML.
- Health: `stale` if `daysSinceIngest>10` or `behindUpstream>10` or never-ingested; else `fresh`.

## 4. Engagement (mini-games)

- Loader: registry + `dynamic()` islands; index never imports game code; adding game = registry + loader + island.
- Status: `available`→route+sitemap; `planned`→card only (404); `experimental`→route iff island, always `noindex`; `archived`→hidden.
- Share: `?result=S-T` display-only challenge hint; fail-closed parse (`^\d{1,2}-\d{1,2}$` + expected total 8/5/6); canonical unchanged on invalid; cap 2048.
- Scoring (non-authoritative, no percentiles/grades): CircleIQ 8×1 strong-read; Replay 5× lined-up; Generator 6× stronger-read; LootDash 45s/360×480/supplies10/cache25/medkit+5or15/combo+2≤4s/3-lives; seeded `mulberry32` shuffle presentation-only.

## 5. Billing / entitlement (design reference; prices void)

- One-time checkout per period (manual renewal); `payment.succeeded/captured` only fulfills; `subscription.*` recorded never provisioned.
- Server-authoritative pricing (UUIDs only); buyer from session; market from plan currency; USD only Sponsorship Tracking; `USD+all-access` rejected.
- Checkout: owner/admin, plan active, product exists + one-time/fixed/currency/amount validated, order `created` first, `returnUrl?orderId=` required.
- Verify: `razorpay_order_id` equality → HMAC `timingSafeEqual` → idempotency by payment id → fetch authoritative → amount/currency/status equality → atomic RPC.
- Webhook: HMAC+timestamp → unique `(provider,external_event_id)` → claim `pending→processing` → server metadata → authoritative fetch → cross-check (ids, amounts, currency, plan, product, org, provider, empty subscriptions, success status) → RPC. Terminal non-success marks `failed` only.
- Expiry: UTC calendar +1mo/+1yr EOM-clamped; renewal `max(existing,now)+period`; NULL never downgraded; Free→paid upgrades with `now()+period`.
- Free quotas (archived): sponsorship 1 active+1 draft / 1 channel / 10 checks-mo UTC / 7-day history / no export; roster/prize-splitter unlimited free.
- Void prices (do not reuse): ₹699/₹799/₹1,499/₹2,499 mo and yearly ×10; $19/$190 USD. D-10/D-17 pending.

## 6. Admin / audit / identity

- Super-admin: `is_super_admin()` deny-by-default; all admin ops `requireSuperAdmin` → admin client; grant/revoke with UUID + reason≥5; revoke atomic, never zero admins; all writes audited.
- Audit: `action ^[a-z_]+\.[a-z_]+$`, secret-scan before/after (throw on `password/secret/token/session/hash/api_key…`), IP validated; append-only triggers (no UPDATE/DELETE incl. service-role); select super-admin only; pagination 50, page≤1000; `safeAuditProjection` (40 keys/20 entries/200ch, forbidden counted).
- Ledger: `(job_id,run_id)` unique; INSERT must `running`; UPDATE only `running→succeeded|failed` + immutable ids + `completed_at`; DELETE rejected; terminal immutable.
- Org matrix: owner>admin>member; `add(owner→member|admin, admin→member)`, `remove(owner→admin|member, never self/owner)`, `change(member↔admin owner-only)`, `leave(any except sole owner)`, `transfer(current owner→same-org member|admin, promote-first)`; direct member writes via RPCs only; `owner_id` change via transfer RPC only.
