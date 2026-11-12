# 01 — Exact Legacy Source Map

All paths absolute under `D:\Projects\MicroNest MicroTools - Esports\ref\legacy-project\`. App root `application/src/`, migrations `supabase/migrations/`. No files modified.

## 1. Finder — `application/src/features/finder/`

**Domain (pure):**
- `domain/levels.ts` — `COMPETITIVE_LEVELS`, `isCompetitiveLevel`, `levelIndex`, `meetsLevelMinimum` (6-step `casual→professional`, 1-below window). Test: `domain/levels.test.ts`.
- `domain/roles.ts` — `SUPPORTED_GAMES=['bgmi']`, `BGMI_ROLES=[IGL,Assaulter,Support,Scout]`, `isSupportedGame`, `isRoleForGame`, `normalizeRegion`, `regionsCompatible` (ANY tokens `any/all/pan-india/online`). Test: `domain/roles.test.ts`.
- `domain/matching.ts` — `normalizeAvailabilityToken`, `availabilityOverlaps`, `hardFiltersPass` (same game, `open`, `looking_for`, region, role∈{primary+secondary}, level window), `rankMatch` → `strong/good/stretch/no-match` (count-based, deterministic, no scores). Test: `domain/matching.test.ts`.

**Schemas (zod, mirrors CHECKs):**
- `schemas/finder.ts` — `handleSchema` (3–20 `^[a-z0-9_]+$`), `characterIdSchema` (TEXT 4–12 digits), `ignSchema`, `bioSchema` (≤280), `teamSchema`/`teamCreateSchema`/`teamUpdateSchema` (slug 2–60, no ownership takeover), `recruitmentPostCreateSchema`/`UpdateSchema` (slots 1–10, status enum, `expires_at`), `applicationCreateSchema`/`DecideSchema` (`shortlisted|accepted|declined`), `reportSchema` (10–1000ch), caps (languages≤5, availability≤7, secondary≤3). Tests: `schemas/finder.test.ts`, `finder-phase-c.test.ts`.

**Repositories (thin Supabase, no auth):**
- `repositories/finder.ts` — `findFinderProfileByUserId`, `findGameProfileByUserAndGame`, `upsertFinderProfile`, `upsertGameProfile`, `createTeam/updateTeam/deleteTeam`, `insertTeamMember/updateTeamMemberRole/deleteTeamMember`, `listTeamMembers/listMyMemberships/listTeamsForCaptain`, `createRecruitmentPost/updateRecruitmentPost/deleteRecruitmentPost`, `listOpenRecruitmentPosts/listRecruitmentPostsForTeam/listOpenPostsForTeam`, `createApplication/withdrawApplication/decideApplication`, `listApplicationsForPost/listMyApplications`, `searchPublicPlayers/searchPublicTeams` (masked views only, `LIKE` escaped, limit 60), `findPublicPlayerByHandle/findPublicTeamBySlug`, `PUBLIC_PLAYER_COLUMNS/PUBLIC_TEAM_COLUMNS`.

**Services (session-derived `userId`, captain gates):**
- `services/profile-service.ts` — `saveMyProfile(supabase,userId,raw)` (upserts, `23505`→conflict).
- `services/team-service.ts` — `assertTeamCaptain` (captain_user_id|created_by|member `captain`), `createMyTeam`, `updateMyTeam`.
- `services/recruitment-service.ts` — `createRecruitmentPostForCaptain`, `updateRecruitmentPostForCaptain`, `setRecruitmentPostStatus`.
- `services/application-service.ts` — `applyToPost` (partial unique guard), `withdrawMyApplication`, `decideApplicationAsCaptain` (accept→auto-roster).
- `services/player-search.ts` — `parsePlayerSearchParams`, `activeFilterCount` (lenient, BGMI default).
- `services/team-search.ts` — `parseTeamSearchParams`, `activeTeamFilterCount` (`recruitingOnly` default).
- `services/team-logo-service.ts` — `validateTeamLogoFile`, `uploadTeamLogo`, `removeTeamLogo` (`finder-avatars/{teamId}/logo.*`, 512KB, png/jpeg/webp).
- `services/fit-reasons.ts` — `buildFitReasons` (5 factual reasons, source-labelled).

**Components:** `player-card.tsx`, `team-card.tsx`, `recruitment-post-card.tsx`, `verification-badge.tsx`, `fit-reasons.tsx` (masked-only rendering).

**Migrations:** `20251121000001_finder_foundation.sql` (8 tables: `finder_profiles/game_profiles/verification_submissions/teams/team_members/recruitment_posts/applications/reports` + CHECKs + RLS + helpers `is_finder_team_member/captain/post_captain`, `can_manage_finder_avatar/evidence`), `20251122000001_finder_public_view_bio.sql` (`finder_public_players/teams` masked views, `GRANT SELECT anon,authenticated`).

## 2. Roster-Builder — `application/src/features/roster-builder/`

**Pure domain (zero DB/auth/network):**
- `types/index.ts` — caps `MAX_INPUT_CHARS 50000`, `MAX_LINES 2000`, `MAX_TEAMS 200`, `MAX_PLAYERS 2000`, `MAX_LINE_LENGTH 300`, capacity 1–30.
- `services/normalize.ts` — `stripZeroWidth`, `isBlank`, `normalizeIdentity` (NFC+zero-width+collapse+lower), `displayName` (preserves case/punct).
- `services/parser.ts` — `splitLine`, `detectDelimiter` (tab/comma/semicolon/pipe, header-scored), `looksLikeHeader` (TEAM/PLAYER/CONTACT token sets), `parseRosterText` (guards, `r<line>` IDs, `teamKey/playerKey`, status `valid/missing-team/missing-player/malformed`).
- `services/conflicts.ts` — `detectConflicts`, `parseErrorToIssue`, `summarizeIssues` (blocking: missing, cross-team, over-capacity; review: exact/near duplicates, team variants; info: aggregates).
- `services/slots.ts` — `buildWorkingModel`, `assignSlots` (`slot=index+1`), `moveTeamUp/Down`, `reorderTeams`, `movePlayerUp/Down`, `addTeam/removeTeam`.
- `services/output.ts` — `buildCopyText`, `needsCsvGuard/escapeCsvCell` (formula-injection guard), `buildCsv`, `buildPrintModel`.
- `services/whatsapp.ts` — `buildRosterWhatsAppMessage` (budget `WHATSAPP_PREFILL_BUDGET=1500` from `@/lib/share/whatsapp`).
- `schemas/index.ts` — `delimiterSchema`, `pastedInputSchema`, `teamCapacitySchema`, `parseOptionsSchema`.

**Impure edges:** `actions/claim-actions.ts` (`claimFreeRosterBuilderAction`), `server/services/roster-builder-policy.ts` (`ensureFreeRosterBuilderGrant`), `config/tools/policy.ts` (`roster-builder:{org,false,true,true,{}}` — unlimited), migration `20251106000001_roster_builder_launch.sql` (catalog row only).

## 3. Tournament Hub — `application/src/features/bgmi-tournaments/` + `bgmi-qualification/`

- `types.ts` — `BgmiTournament/Stage/Team/MatchResult/Match/StageEntry/StageDataset/StandingRow`.
- `adapters/liquipedia.ts` — `parseTournamentStage`, `parseStageDataset`, `parseParams/splitParams/extractTemplateAt/findTemplates/extractSection/parseInfoboxLeague`, `normalizeTeamKey/displayTeamName`, `parseMapDate`, `isSatOutMsCell/isEmptyMsCell`, `parseMatchBlock`, `TOURNAMENT_CATALOG` (bmsd-2026, bmps-2026, bgmi-showdown-2026), `assertCanonicalScoring`.
- `adapters/safe-fetch.ts` — `assertSafePageTitle`, `safeFetchLiquipediaJson` (allowlist `liquipedia.net/pubgmobile/api.php`, 20s, 4MB, UA).
- `services/ingest.ts` — `ingestTournamentStage` (fetch→parse→validate all-or-nothing→publish, per-stage isolation, idempotent `unchanged`).
- `services/validate.ts` — `validateStageDataset` (fails closed, preserves published).
- `services/points.ts` — `BGMI_POINTS_TABLE_2026=[10,6,5,4,3,2,1,1]`, `matchTotal/stageTotal`, `isCanonicalTable2026`.
- `services/standings.ts` — `deriveStandings` (total desc → WWCD → placement → finishes → best recent), `stageTotalsFrom`.
- `services/stage-copy.ts` — `stageMessaging` (Smash callout, `Standings` vs `Current points race`).
- `repositories/store.ts` — `createSupabaseBgmiStore` (`getTournament/getStage/publishDataset/recordRun/completeRun`, service-role upserts).
- `repositories/reads.ts` — `listTournaments/getTournament/listStages/getStageDetail` (`published=true` only, derive standings).
- Route `app/api/ingest/bgmi-tournaments/route.ts` (auth→ledger start→per-stage ingest→ledger complete, HTTP 200 + `ok:false` on failure). Workflow `.github/workflows/bgmi-tournaments-ingest.yml` (daily `0 8 * * *`, matrix, body-gated). Migrations `20251113000001_bgmi_tournaments_core.sql` (`bgmi_tournaments/stages/teams/stage_entries/matches/match_results` + `bgmi_ingestion_runs`), `20251113000002_bgmi_bmsd_seed.sql`.
- Qualification: `bgmi-qualification/services/{presets,scoring,format,share,copy,whatsapp}.ts` (`KRAFTON_2026_PRESET`, `pointsGap/requiredRate/compareToTarget/planningBand`), components `qualification-calculator.tsx/scenario-editor.tsx/share-block.tsx` (client-only, no DB).

## 4. Sponsor-Sentinel — `application/src/features/sponsor-sentinel/` + `server/{scanner,services/repositories/integrations/cron/events}`

- `schemas/rules.ts` — `deliverableRuleSchema` (10 rule types), `validateRulesForPlatform`.
- `services/evaluator.ts` — `evaluateRule` → `PASS/FAIL/PENDING/NOT_VERIFIABLE/NOT_SUPPORTED`.
- `services/capabilities.ts` — `getCapabilities/isCapabilitySupported` (Kick VOD false).
- `services/normalization.ts` — `normalizeText/Hashtag/CategoryId/TagValue`, duration parsers.
- `services/proof-grouping.ts` — `groupEvidenceByPlatform/groupProofByContent/groupProofByDeliverable`.
- `services/campaign-service.ts` + `campaign-lifecycle.ts` (`createCampaign`, `canTransition/assertTransition`, `activateCampaign`) + `deliverable-service.ts` + `connected-channel-service.ts` + `channel-validation.ts` (`assertChannelUsable`) + `scan-action.ts` (`requestManualScan`) + `scan-history.ts` (`getScanHistory`, `HISTORY_LIMIT=50`) + `scan-detail.ts` + `budget.ts`.
- Actions: `campaign-actions.ts` (`create/activate/complete/update/archive/requestScan`), `channel-actions.ts` (OAuth connect ×3), `deliverable-actions.ts`, `free-tier-actions.ts`, `integration-actions.ts`.
- Scanner: `server/scanner/scan-orchestrator.ts` (`executeScan`, `SCANNER_VERSION='sentinel-mock-1'`, `PROVIDER_CONCURRENCY=3`), `scan-types.ts`, `scan-errors.ts`, `scan-targeted-youtube.ts` (`TARGETED_SCANNER_VERSION='websub-targeted-1'`).
- Free-tier: `server/services/sponsorship-limits.ts` (1 campaign/1 channel/10 checks/mo/7-day history, `reserveFreeCheckOrThrow`), `sponsorship-policy.ts`, `sponsorship-access.ts` (`hasSponsorshipAccessForOrg`), `user-sponsorship-service.ts`.
- Repos: `sponsor-campaigns/deliverables/connected-channels/scans/evidence/evaluations/webhook-events/user-entitlements.ts`.
- Integrations: `server/integrations/{twitch,youtube,kick,mock}/{provider,client,oauth,verifier,parser,mappers,budget}.ts` + `registry.ts` (`createProviderRegistry/createProviderRegistryForOrg`).
- Events/webhooks: `server/webhooks/verifier.ts`, `server/events/{classifier,event-pipeline,ingestor,normalizer,sentinel-handler,tenant-resolver}.ts`, `server/subscriptions/{reconciler,twitch,youtube,kick}.ts`, routes `app/api/webhooks/{twitch,youtube,kick}/route.ts`, `app/api/auth/{twitch,youtube,kick}/{start,callback}/route.ts`.
- Cron: `server/cron/sentinel-scan.ts` (`loadEligibleCampaigns/runCampaignScans`), `sentinel-retention.ts` (`RETENTION_BATCH_SIZE=500`, 90/90/90/30d), `cron-auth.ts` (`assertCronAuth`), `run-ledger.ts`. Migrations: `20251001000001_sponsor_sentinel_core` … `20251025000001_sponsorship_free_check_consumption` (`consume_free_check`).

## 5. Meta-Parser — `application/src/features/meta-parser/`

- `adapters/registry.ts` — `MetaParserAdapter` interface, `registerAdapter/getAdapter/registeredAdapterKeys`; `adapters/index.ts` (`registerAllAdapters`).
- Per-game `adapters/{dota-2,lol,valorant}/{adapter,discovery,parse,html,sources,aliases}.ts`.
- `services/ingest.ts` (`ingestGamePatches`, `isCurrentParse`, `META_PARSER_CONFLICT_CODE`), `safe-fetch.ts` (`safeFetchText`), `sanitize.ts` (`sanitizePatchText`, `containsMarkup`), `entity-normalize.ts` (`normalizeEntityName`), `health.ts` (`assessFreshness`, `STALE_AFTER_DAYS=10`), `job-id.ts`, `conflict.ts`, `numeric-extract.ts` (`extractTransition`), `direction-map.ts` (`classifyChange`, `resolvePolarity`).
- `repositories/store.ts` (`createSupabaseMetaParserStore`), `repositories/reads.ts` (`listGames/listPatches/getPatch/listChanges/groupPublishedChanges`).
- Route `app/api/ingest/meta-parser/route.ts`, workflow `meta-parser-ingest.yml` (daily `0 7 * * *`, matrix 3 games), migrations `20251111000001_meta_parser_core.sql` + `20251112000001_meta_parser_publication.sql`.

## 6. BGMI Lab — `application/src/features/bgmi-lab/`

- `games.tsx` — `LAB_GAME_LOADERS`, `resolveLabGame`, `hasLabGame` (`dynamic()` islands ×6).
- `share-result-url.ts` — `buildLabResultShareUrl`, `parseLabSharedResult/FromSearch` (`?result=S-T`, fail-closed, `MAX_RAW=16`).
- `share-message.ts` — `buildLabShareMessage`, `isShareAbort`.
- Shells: `circle-iq-shell.tsx`, `loot-dash-shell.tsx`, `rotation-replay-shell.tsx`, `igl-decision-shell.tsx`, `zone-pattern-explorer-shell.tsx`, `tournament-scenario-generator-shell.tsx`, `share-row.tsx`, `shared-result-banner.tsx`.
- Data/logic: `data/circle-iq-{logic,rounds,crossings}.ts` (`scorePick`, seeded `mulberry32`, `MAP_TAP_THRESHOLD=36`), `rotation-replay-{logic,scenarios}.ts`, `tournament-scenario-generator-{logic,scenarios}.ts`, `tournament-scenarios.ts`, `igl-decision-{logic,scenarios}.ts`, `zone-pattern-{data,patterns}.ts`, `loot-dash-{sim,render,theme,pointer,interaction}.ts` (`WIDTH=360/HEIGHT=480/DURATION=45s/LIVES=3`).
- Config `config/public/bgmi-lab.ts` (`BGMI_LAB_TOOLS[9]`, `getBgmiLabTool/getAvailable/getRoutable/isLabSlugRoutable`). Routes `app/bgmi-lab/page.tsx`, `[slug]/page.tsx` (`dynamicParams=false`), `[slug]/opengraph-image.tsx`.

## 7. Billing — `application/src/server/billing/` + services/repos/routes

- `provider.ts` (`BillingProvider`, `EntitlementGrant`), `dodo.ts` (`createDodoCheckoutSession`, `verifyDodoWebhook`, `fetchDodoPayment`, `parseDodoWebhook`, `validateDodoProduct`, currency/market maps), `razorpay.ts` (`createRazorpayOrder`, `verifyRazorpayPayment/Webhook`, `fetchRazorpayPayment`, `parseRazorpayWebhook`), `checkout-service.ts` (`createCheckoutOrder`), `verify-service.ts` (`verifyPaymentAndActivate`), `plan-context.ts` (`getPlanContext` INR-only), `period.ts` (`addBillingPeriod`), `expiry.ts` (`calculateRenewedExpiry`), `live-test-service.ts` (`LIVE_TEST_AMOUNT_MINOR=100`), `index.ts`.
- `server/services/billing-service.ts` (`getBillingOverview`, `buildBillingToolSections`), `entitlement-service.ts` (`resolveEntitlements`, `canAccessTool`).
- Repos: `orders/payments/plans/tools/webhook-events/entitlements/user-entitlements.ts`.
- Routes: `app/api/billing/{checkout,verify,order-status,live-test/checkout}/route.ts`, `app/api/webhooks/{dodo,razorpay}/route.ts`. Script `scripts/dodo-validate-products.mjs`.

## 8. Admin / audit / identity / catalog

- `server/admin/{platform-admins,audit,audit-log,sentinel,meta-parser-health,billing,billing-repairs,billing-exceptions,entitlements,customers,organizations,users,user-entitlements,overview,health,system,superadmin-actions}.ts` — `listPlatformAdmins/grantPlatformAdmin/revokePlatformAdmin`, `recordAdminAudit/getRequestIp`, `getAdminAuditLog/safeAuditProjection`, `recordCronRunStart/Complete/getCronLedgerSummaries`, `assertCronAuth`, `determineMetaParserStatus/getMetaParserHealth`.
- `server/cron/{run-ledger,cron-auth,sentinel-scan,sentinel-retention,retention-config}.ts`.
- Migrations: `20250930000002_rls.sql` (`is_org_member/is_org_admin/is_org_owner/has_tool_access`), `20251014000001_platform_admin_foundation.sql` (`platform_admins`, `is_super_admin`), `20251014000002_admin_audit_append_only.sql`, `20251107000001_cron_run_ledger.sql`, `20251108000001_superadmin_v1_03_hardening.sql`, `20251109000001_org_members_hardening.sql`, `20251110000001_org_owner_deletion_safety.sql`.
- Catalog: `config/games/catalog.ts` (`GameSlug[10]`, `GAMES[]`, `getGameBySlug` alias-insensitive).
