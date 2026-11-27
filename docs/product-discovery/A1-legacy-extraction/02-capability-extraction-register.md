# 02 — Capability Extraction Register

Decision key: **PORT** = isolated code safely adaptable · **REIMPLEMENT** = behavior recreated fresh · **DOCUMENT** = spec only · **REJECT** = not needed · **DEFER** = valuable later. Every PORT/REIMPLEMENT cites exact legacy paths.

## 1. Finder

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| Level enum + 1-below window (`levels.ts`) | REIMPLEMENT | `features/finder/domain/levels.ts` (`meetsLevelMinimum`), test `levels.test.ts` | Pure rule; copy concept, rewrite against new `games(key)` vocabulary |
| BGMI role allowlist + region compat (`roles.ts`) | REIMPLEMENT | `features/finder/domain/roles.ts` (`isRoleForGame`, `regionsCompatible`), test `roles.test.ts` | Hardcoded `bgmi`; new titles need fresh vocabularies |
| Hard-filter + tier ranking (`matching.ts`, no scores) | REIMPLEMENT | `features/finder/domain/matching.ts` (`hardFiltersPass`, `rankMatch`), test `matching.test.ts` | No-score tier (`strong/good/stretch`) fits discovery; automated matching scores remain out-of-scope |
| Lenient search-param parsers | PORT | `services/player-search.ts` (`parsePlayerSearchParams`), `services/team-search.ts`, tests | Pure, dependency-free, tested; adapt param names to new directory |
| Fit reasons (factual, source-labelled) | REIMPLEMENT | `services/fit-reasons.ts` (`buildFitReasons`), test | Copy presentation contract, not implementation |
| Zod contracts (handle/character/slug/slots/status) | REIMPLEMENT | `schemas/finder.ts` + tests | Field shapes valuable; `character_id` TEXT rule must be re-decided (D-G1-04 closed: omit `game_user_id`) |
| Team formation + captain gate (`assertTeamCaptain`, creator-is-captain) | REIMPLEMENT | `services/team-service.ts`, `repositories/finder.ts`, migration `20251121000001` | Core business rule; rebuild against new `teams` + fresh RLS |
| Recruitment post lifecycle (captain-gated, expiry) | REIMPLEMENT | `services/recruitment-service.ts` | Needed for Opportunities; rebuild |
| Application lifecycle (partial-unique, withdraw, accept→roster) | REIMPLEMENT | `services/application-service.ts` (`applyToPost`, `decideApplicationAsCaptain`), test | Active-application unique + auto-roster pattern; rebuild, never migrate tables |
| Masked public views (12-col-style, no user IDs) | REIMPLEMENT | `repositories/finder.ts` (`PUBLIC_*_COLUMNS`), `20251122000001` views | Pattern matches G1 masked projection; rebuild per-entity, fresh RPCs |
| Team logo upload (512KB, fixed path, upsert) | REIMPLEMENT | `services/team-logo-service.ts`, bucket `finder-avatars` | Adapt to `public-entity-media` + fresh storage policies |
| Reports (`finder_reports` polymorphic shape) | DOCUMENT | `schemas/finder.ts` (`reportSchema`), migration | Keep target-type enum + 10–1000ch rule as spec for moderation queue |
| Verification submissions flow | DOCUMENT + DEFER | `finder_verification_submissions` + service refs | Spec only; G1 forbids badges; build only with brand pillar |

## 2. Roster-Builder

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| `normalizeIdentity`/`displayName` | PORT | `services/normalize.ts`, `normalize.test.ts`, `purity.test.ts` | Zero imports, deterministic; directly adaptable to `src/lib/` |
| Delimiter-detect + quote-aware parser + header map | PORT | `services/parser.ts` (`detectDelimiter`, `parseRosterText`), `parser.test.ts` | Pure, capped (50k/2000/200/2000), tested; adapt caps to organizer intake |
| Conflict engine (blocking/review/info, line refs) | PORT | `services/conflicts.ts` (`detectConflicts`), `conflicts.test.ts` | Never merges — safe organizer primitive |
| Slot model (`slot=index+1`, reorder/add/remove) | PORT | `services/slots.ts`, `slots.test.ts` | Pure immutable ops; adapt to team model |
| Copy/CSV/print + injection guard | PORT | `services/output.ts` (`escapeCsvCell`), `output.test.ts` | CSV formula guard valuable; adapt |
| WhatsApp composer (budget 1500) | REIMPLEMENT | `services/whatsapp.ts`, `lib/share/whatsapp.ts` | Keep budget pattern; rewrite share copy for new IA |
| Zod option schemas | PORT | `schemas/index.ts` | Structural caps reusable |
| Free-grant policy shape (unlimited free) | DOCUMENT | `server/services/roster-builder-policy.ts`, `config/tools/policy.ts` | Entitlement shape only; no billing restore |
| Workspace/session components | REJECT | `components/roster-*-*.tsx` | Tied to legacy org/entitlement UX; rebuild UI fresh |

## 3. Tournament Hub

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| Validate-before-publish gate | REIMPLEMENT | `services/validate.ts`, `adapters/liquipedia.ts:assertCanonicalScoring` | Fail-closed, preserves published — required for editorial listings |
| Body-gated observability (`ok:false` on HTTP 200 + ledger) | REIMPLEMENT | `app/api/ingest/bgmi-tournaments/route.ts`, `bgmi-tournaments-ingest.yml`, `server/cron/run-ledger.ts` | Prevents silent cron success; adopt for all ingest |
| Safe-fetch (allowlist + timeout + size cap) | REIMPLEMENT | `adapters/safe-fetch.ts` | Generic editorial-fetch primitive |
| Points table + standings derivation (never store totals) | DOCUMENT | `services/points.ts` (`BGMI_POINTS_TABLE_2026`), `services/standings.ts` (`deriveStandings`) | Spec for KRAFTON 2026 math; new product is discovery-only, never live scoring |
| Sitemap/list helpers (fail-closed anon reads) | REIMPLEMENT | `lib/marketing/bgmi-tournaments-sitemap.ts`, `repositories/reads.ts` | Published-only read pattern |
| Stage-copy Smash callout | DOCUMENT | `services/stage-copy.ts` | Copy rule only |
| Qualification simulator as product | REJECT | `features/bgmi-qualification/` | Calculator, not discovery; keep as reference logic only |
| Legacy tournament schema/seed | REJECT | `20251113000001/02` migrations | New `tournaments` schema per `target-schema.md`; never restore |

## 4. Sponsor-Sentinel

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| Evidence model (campaign→deliverable→evidence→evaluation→scan) | DOCUMENT + DEFER | `sponsor-campaigns/deliverables/evidence/evaluations/scans.ts` repos, `20251001000001` migration | Valuable for future brand pillar; no brand tables exist yet |
| Platform capability matrix (Kick VOD false) | DOCUMENT | `services/capabilities.ts`, `config/marketing/tools.ts:34` | Preserve truth: Kick live/channel only, no recorded-VOD |
| Rule evaluator (`PASS/FAIL/PENDING/NOT_VERIFIABLE/NOT_SUPPORTED`) | DOCUMENT + DEFER | `services/evaluator.ts` | Rebuild only if proof-scanning approved |
| Proof-grouping (by content/deliverable, never infer) | DOCUMENT + DEFER | `services/proof-grouping.ts` | Display contract |
| Orchestrator stages + concurrency + idempotency | DOCUMENT + DEFER | `server/scanner/scan-orchestrator.ts`, `scans.ts` (`tryCreateScanWithLock`) | Heavy org/quota complexity; fresh design required |
| OAuth connect flows (Twitch/YouTube/Kick) | DOCUMENT + DEFER | `actions/channel-actions.ts`, `server/integrations/*/oauth.ts` | Concepts only; secrets never carried over |
| Webhook verify/parse/normalize/tenant/ingest pipeline | DOCUMENT + DEFER | `server/webhooks/verifier.ts`, `server/events/*.ts` | Rebuild with fresh secrets/cron |
| Free-tier quota shape (1/1/10/7-day) | DOCUMENT | `server/services/sponsorship-limits.ts`, `consume_free_check` RPC | Quota design reference; prices void |
| Full Sentinel build | DEFER (REBUILD later) | Whole subsystem | A0 REBUILD verdict stands; not Discovery MVP |

## 5. Meta-Parser

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| Safe-fetch + sanitizer + entity-normalize | REIMPLEMENT | `services/safe-fetch.ts`, `sanitize.ts`, `entity-normalize.ts` + tests | Directly useful for news/tournament editorial ingestion |
| Revision semantics (unchanged vs revised, provisional→promote) | REIMPLEMENT | `services/ingest.ts` | Prevents duplicate logical patches |
| Health/freshness (`STALE_AFTER_DAYS=10`) | REIMPLEMENT | `services/health.ts` | Editorial freshness signal |
| Adapter registry (one pipeline, N games) | REIMPLEMENT | `adapters/registry.ts`, `adapters/index.ts` | Add-game = adapter + catalog row; MLBB gated |
| Numeric-extract + direction-map | DOCUMENT + DEFER | `services/numeric-extract.ts`, `direction-map.ts` | Patch-specific; adopt only if patch-intel section approved |
| Full patch schema/tables | REJECT | `20251111000001/02` migrations | New `news_articles` schema instead |

## 6. BGMI Lab

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| Loader/island map (`dynamic()`, index never imports game code) | REIMPLEMENT | `features/bgmi-lab/games.tsx` | Performance + IA pattern for Phase 7 |
| Share-URL + challenge banner (`?result=S-T`, fail-closed) | REIMPLEMENT | `share-result-url.ts`, `shared-result-banner.tsx` | Ephemeral challenge pattern, no leaderboard |
| Share message + budget | REIMPLEMENT | `share-message.ts` | Adapt copy |
| Drill logic (1 of Circle IQ / Loot Dash) | REIMPLEMENT (one only) | `data/circle-iq-logic.ts` or `loot-dash-sim.ts` | Single drill; no-score, soft signal; 9-port rejected |
| Registry status machine (available/planned/experimental/archived) | REIMPLEMENT | `config/public/bgmi-lab.ts` | Prevents dead links/sitemap leaks |
| Remaining 8 drills | REJECT for now | Data/logic files | Consolidate to 1–2; rest reference only |

## 7. Billing

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| Provider abstraction (`BillingProvider`, `EntitlementGrant`) | DOCUMENT | `server/billing/provider.ts` | Keep interface shape; D-17 undecided |
| Server-authoritative pricing (UUIDs only, no client amounts) | REIMPLEMENT (when approved) | `checkout-service.ts`, route guards | Security invariant |
| HMAC/timestamp webhook verify + raw-body | REIMPLEMENT (when approved) | `server/billing/dodo.ts` (`verifyDodoWebhook`), `razorpay.ts`, `server/webhooks/verifier.ts` | Replay protection |
| Idempotency (`webhook_events` unique + `pending→processing→succeeded/failed`) | REIMPLEMENT (when approved) | `repositories/webhook-events.ts`, `complete_*_payment` RPCs | Exactly-once fulfillment |
| Expiry math (`max(existing,now)+period`, EOM clamp) | REIMPLEMENT (when approved) | `period.ts`, `expiry.ts` | Calendar-correct renewal |
| Dodo validator script pattern | PORT (tooling only) | `scripts/dodo-validate-products.mjs` | Read-only product diagnostic; adapt when provider chosen |
| Live-test guard (allowlist + hardcoded 100 INR) | DOCUMENT | `live-test-service.ts` | Safety pattern; never enable without approval |
| Plans/prices/subscriptions/products | REJECT | `20251008000001_pricing_v1_plans.sql`, `20251120000001_*_usd_activation.sql`, `plans` rows | Void; D-10/D-17 pending; never seed |

## 8. Admin / audit / identity / catalog

| Capability | Decision | Legacy evidence | Rationale |
|---|---|---|---|
| `is_super_admin` gate + `requireSuperAdmin` | REIMPLEMENT | `20251014000001`, `server/admin/*` | Deny-by-default admin; fresh implementation |
| Append-only audit (`admin_audit_logs` + triggers, `safeAuditProjection`) | REIMPLEMENT | `20251014000002`, `server/admin/audit*.ts` | Backbone for review queues; secret-scan + redaction preserved |
| `cron_run_ledger` lifecycle | REIMPLEMENT | `20251107000001`, `server/cron/run-ledger.ts` | Ingest job observability |
| Org role matrix RPCs (add/remove/change/leave/transfer) | DOCUMENT | `20251109000001`, `20251110000001` | Design reference for future orgs; fresh RLS required |
| `is_org_member/admin/owner`, `has_tool_access` shape | DOCUMENT | `20250930000002_rls.sql` | Shape only; never copy RLS file |
| `ensure_app_user`-style bootstrap | REUSE (already in G1) | Greenfield `ensure_app_user()` | G1 already mirrors; no action |
| Static game catalog pattern | REIMPLEMENT | `config/games/catalog.ts`, `catalog.test.ts` | Pure lookup + alias map; redesign BGMI-first |
| Workspace analytics | DEFER | `server/services/workspace-activity.ts` | Needs metric validation |
