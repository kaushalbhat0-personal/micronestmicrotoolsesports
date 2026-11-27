# 02 — Legacy Code Inventory

**Scope:** `ref/legacy-project/` (1299 files, ~11.4 MB) + git history. **Status:** reference-only (`ref/legacy-project/README.md`). No imports, no migration restores.

## 1. Archive layout

| Directory | Files | Notes |
|---|---|---|
| `ref/legacy-project/application/` | 1226 | Previous Next.js app, tests, docs, demos, `vercel.json` (crons), GitHub workflows |
| `ref/legacy-project/supabase/` | 60 | `config.toml`, 58 historical migrations (`20250930000001_initial_schema` → `20251122000001_finder_public_view_bio`), `seed.sql` |
| `ref/legacy-project/toolchain/` | 11 | `package.json` (Next 15, `dodopayments@2.55.0`, `razorpay@2.9.8`), `next.config.ts`, `tsconfig.json`, `vitest.config.ts` |
| `ref/legacy-project/deployment/` | 1 | Pointer README only |
| `ref/legacy-project/README.md` | — | Rules: no imports, no secrets, no local state |

Git checkpoints: `caff7a2` (legacy checkpoint), `dc5aee0`/`b6897a3` (archive + greenfield init), `01893ae` (clean backend foundation). Feature history confirms billing (`06f75d7` Dodo), tournaments ingest (`b882c21`), BGMI Lab (`bde4a7f`…`09bfa51`).

## 2. Significant subsystems

### A. Sponsor-Sentinel (flagship micro-SaaS)
- **Intent:** org-scoped sponsorship proof-of-performance: channels → campaigns/deliverables → Twitch/YouTube/Kick scans → evidence/evaluations, free-tier gating + retention.
- **Implemented:** yes. `application/src/features/sponsor-sentinel/` (actions, components, schemas, services, `README.md`), `server/scanner/`, `server/services/sponsorship-*`, `server/repositories/`, `server/cron/sentinel-scan.ts` + `sentinel-retention.ts`, `server/integrations/{twitch,youtube,kick}/`, webhooks + OAuth callbacks, `vercel.json` crons (`sentinel-scan 0 6 * * *`, `sentinel-retention 0 4 * * *`), migrations `20251001000001_sponsor_sentinel_core` … `20251025000001_sponsorship_free_check_consumption` + USD billing migrations.
- **Tested:** yes, heavily (scan batch/concurrency/proof, free-check consumption, sponsorship access/limits).
- **Deployed:** likely (cron + webhook + live-test markers) but no deployment logs in archive — UNKNOWN.
- **Domain value:** high for Brands pillar but org/user-grant + quota complexity requires redesign.
- **Classification:** REBUILD.

### B. Billing rails (Razorpay + Dodo; Stripe stub)
- **Intent:** provider-agnostic one-time fixed-price checkouts, INR+USD, order→payment→entitlement, live-test safety.
- **Implemented:** yes. `server/billing/{dodo,razorpay,provider,checkout-service,verify-service,expiry,period,plan-context,live-test-service}.ts`, `server/services/billing-service.ts` + `entitlement-service.ts`, `app/api/billing/*`, `app/api/webhooks/dodo|razorpay|stripe|twitch|kick|youtube/route.ts`, `scripts/dodo-validate-products.mjs`, migrations `20251007000001_billing_foundation` … `20251120000001_sponsorship_usd_activation` + `complete_billing_payment` / `complete_dodo_payment` RPCs.
- **Tested:** yes, thoroughly (foundation, Dodo international, Razorpay, checkout-verify, expiry/period, webhook INR fixtures).
- **Deployed:** likely (dashboard products mapped via env) but live charge proof absent — UNKNOWN.
- **Classification:** ADAPT (mine `dodo.ts`/`verify-service.ts`/webhook idempotency; do not seed legacy tools/plans).

### C. BGMI-Lab engagement drills
- **Intent:** public client-playable skill games + shareable result URLs with recipient challenge banner.
- **Implemented:** yes (6 available: Circle IQ, Loot Dash, Rotation Replay, IGL Decision Drill, Zone Patterns, Tournament Scenario Generator; 3 planned). `features/bgmi-lab/games.tsx` loader map, `components/*-shell`, `data/*`, `share-message.ts` + `share-result-url.ts`, routes `app/bgmi-lab/`.
- **Tested:** yes, densely (games, share URLs, circle-iq, loot-dash, IGL, rotation, zone, scenarios).
- **Deployed:** pure client islands (`dynamic()`), no DB — plausibly deployed, no proof — UNKNOWN.
- **Classification:** ADAPT (mine loader/island + share-URL pattern; rebuild content for new IA).

### D. Tournaments Hub (BGMI ingest)
- **Intent:** daily-ingested BGMI standings hub (BMSD-2026, BMPS semis/grand-finals/last-chance, Showdown GF).
- **Implemented:** yes. `features/bgmi-tournaments/adapters|services(ingest,points,standings,stage-copy,validate)|repositories/`, `app/api/ingest/bgmi-tournaments/route.ts`, `features/bgmi-qualification/` (client-only simulator), migrations `20251113000001_bgmi_tournaments_core` + `20251113000002_bgmi_bmsd_seed`, workflow `bgmi-tournaments-ingest.yml` (daily, body-gated `ok:false` fails).
- **Tested:** yes (ingest, points, standings, liquipedia, qualification).
- **Classification:** ADAPT (mine adapter + observability contract; rebuild schema for discovery-only domain).

### E. Roster-Builder + Finder (closest discovery ancestor)
- **Intent:** (1) paste messy registrations → normalize/dedupe → flag shared players → assign slots + share/WhatsApp; (2) player/team discovery, recruitment posts, applications, verification, reports.
- **Implemented:** yes. Roster: `features/roster-builder/{actions,components,schemas,services/conflict|normalize|output|parse|purity|slots|whatsapp}`. Finder: `features/finder/{components,domain/levels|matching|roles,repositories,schemas,services/*}`, migrations `20251106000001_roster_builder_launch`, `20251121000001_finder_foundation`, `20251122000001_finder_public_view_bio` (masked views, `finder_*` tables).
- **Tested:** yes (purity/parser/conflicts/output, levels/matching/roles, application auto-add).
- **Classification:** ADAPT (mine pure conflict/normalize/slot services + masked views/anti-duplicate/captain guards; redesign fresh — never migrate `finder_*` tables per D-11).

### F. Meta-Parser (patch-intelligence ingest)
- **Intent:** LoL/Dota-2/Valorant patch ingestion (sanitize → normalize → numeric-extract → direction-map), freshness/health.
- **Implemented:** partial. `features/meta-parser/{adapters/dota-2|lol|valorant,registry,repositories,job-id}`, `app/api/ingest/meta-parser/route.ts`, workflow daily, migrations `20251111000001_meta_parser_core` + `20251112000001_meta_parser_publication`.
- **Classification:** ADAPT (mine safe-fetch/sanitize/entity-normalize/health pattern; rebuild for news/patch section).

### G. Games catalog + per-tool game logic
- **Intent:** shared game identity (10 slugs: cs2, valorant, lol, dota-2, r6, pubg-mobile/BGMI alias, fortnite, RL, apex, COD; MLBB excluded) + draft-ban templates, tie-breaker rules, prize-splitter presets.
- **Implemented:** yes. `config/games/catalog.ts`, draft-ban/tie-breaker/prize-splitter/payout-tracker engines + migrations (draft `20251016000001`…, tie `20251017000001`…, payout `20251103000001`…).
- **Classification:** game catalog ADAPT (reuse static-lookup + alias pattern, redesign BGMI-first slugs); Draft/Tie/Payout/Prize engines RETIRE (dormant — no greenfield pillar needs them; leave tables dormant, never drop without retention decision).

### H. Video / VOD proof-scanning
- **Intent:** multi-platform VOD/live proof (Twitch VOD + YouTube targeted + Kick live/channel; Kick recorded-VOD explicitly unsupported per `config/marketing/tools.ts:34`).
- **Implemented:** yes as part of Sentinel scanner + `server/integrations/{twitch,youtube,kick,mock}/` + verifiers.
- **Classification:** REBUILD if partnerships pillar needs proof-scanning; RETIRE VOD-Clipper/Scrim-Matchmaker/Roster-Sentinel (explicitly removed in `marketing-availability.test.ts:9` — do not resurrect).

### I. Analytics / workspace / admin / audit
- **Intent:** org workspace activity, meta-parser health, tournament standings, superadmin console + append-only audit.
- **Implemented:** yes. `server/services/workspace-activity.ts`, `server/admin/`, `platform_admins` + `admin_audit_logs` (append-only triggers) + `organization_audit_logs` + `cron_run_ledger`, migrations `20251014000001_platform_admin_foundation` … `20251110000001_org_owner_deletion_safety`.
- **Classification:** REUSE admin/audit/ledger pattern (dormant until needed); analytics UNKNOWN (needs product validation).

## 3. Classification summary

| Subsystem | Verdict |
|---|---|
| Identity/tenancy (`profiles`, `organizations`, members, `is_org_member/admin/owner`, `has_tool_access`, `is_super_admin`) | REUSE |
| Admin/audit/ops (`platform_admins`, append-only logs, `cron_run_ledger`, bucket policy pattern) | REUSE |
| Billing rails | ADAPT |
| Game catalog | ADAPT |
| BGMI-Lab | ADAPT |
| Tournaments ingest | ADAPT |
| Finder + Roster parse/normalize | ADAPT |
| Meta-Parser pipeline | ADAPT |
| Sponsor-Sentinel | REBUILD |
| VOD live-scan automation | REBUILD (if needed) |
| Draft-Ban / Tie-Breaker / Payout-Tracker / Prize-Splitter | RETIRE (dormant) |
| VOD-Clipper / Scrim-Matchmaker / Roster-Sentinel | RETIRE |
| Analytics (workspace/standings) | UNKNOWN |
| `YOUTUBE_WEBSUB_VERIFY_TOKEN`, `BILLING_LIVE_TEST_*` flags | UNKNOWN — confirm unused vs live project before removal |

Standing rule: nothing imports from `ref/`; greenfield gets domain-oriented modules. Authoritative reuse analysis already exists at `docs/product-discovery/backend-reuse-audit.md` (REUSE AS-IS / WITH ADAPTATION / REPLACE / DEPRECATE / UNKNOWN).
