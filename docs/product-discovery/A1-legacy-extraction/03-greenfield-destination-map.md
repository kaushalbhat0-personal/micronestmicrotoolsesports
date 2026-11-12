# 03 — Greenfield Destination Map

Planning destinations only. No authorization to create files/directories. No empty modules. G1 (`src/features/player-profile/`) is frozen — extend only via new FK references, never by editing G1 contracts.

## 1. `src/features/teams/` (new, when Phase 2 starts)

- From Finder REIMPLEMENT: `domain/levels.ts` → level vocabulary (rewritten per-title); `domain/roles.ts` → role allowlists; `services/team-service.ts` (`assertTeamCaptain`, creator-is-captain) → team writes; `services/team-logo-service.ts` → logo upload against `public-entity-media` (fresh storage policies); `repositories/finder.ts` team CRUD shape → fresh `teams`/`team_members` tables.
- From Roster PORT: `services/slots.ts` → slot assignment for organizer intake.

## 2. `src/features/organizations/` (new)

- From Finder DOCUMENT: org role-matrix RPC design (`20251109000001`, `20251110000001`) → fresh `organizations`/`organization_members` + transfer/leave semantics.
- From Roster PORT: `services/parser.ts` + `conflicts.ts` → bulk member/roster intake tooling.
- From Admin REIMPLEMENT: `is_org_member/admin/owner` shape → fresh helpers (never copied).

## 3. `src/features/brands/` (new, deferred)

- From Sentinel DOCUMENT only: evidence model (`campaign→deliverable→evidence→evaluation`), capability matrix (Kick VOD false), evaluator outcome enum. No code port until brand pillar approved. No tables now.

## 4. `src/features/opportunities/` (new)

- From Finder REIMPLEMENT: `services/recruitment-service.ts` → post lifecycle; `services/application-service.ts` → apply/withdraw/decide + partial-unique + accept→roster; `schemas/finder.ts` post/application/report shapes (rewritten); `services/player-search.ts`/`team-search.ts` (PORT) → vacancy search parsers; `services/matching.ts` + `fit-reasons.ts` → hard-filter + factual reasons (no scores).

## 5. `src/features/tournaments/` (new)

- From Tournament Hub REIMPLEMENT: `services/validate.ts` gate + `adapters/safe-fetch.ts` + body-gated ingest route + ledger pattern → staff-listed editorial ingestion (D-05). `repositories/reads.ts` published-only shape → fresh `tournaments` reads.
- From Roster PORT: `services/{normalize,parser,conflicts,slots,output}.ts` → organizer registration intake helpers (pure only).
- DOCUMENT only: points/standings math, stage-copy rules. No live scoring tables.

## 6. `src/features/news/` (new)

- From Meta-Parser REIMPLEMENT: `services/{safe-fetch,sanitize,entity-normalize,health}.ts` + `adapters/registry.ts` shape → editorial fetch/sanitize/freshness pipeline; `services/ingest.ts` revision semantics → draft→published promotion. No patch tables.

## 7. `src/features/tools/` (new, free first)

- PORT roster pure services as first free-tool logic (normalize/parser/conflicts/slots/output + zod schemas + CSV guard). UI rebuilt fresh; no entitlement gate for free-unlimited tools.
- Billing rails DOCUMENT only until D-10/D-17; no `plans`/`orders`/`payments` tables.

## 8. `src/features/mini-games/` (new, Phase 7)

- REIMPLEMENT BGMI Lab loader (`games.tsx` `dynamic()` map) + share-URL (`share-result-url.ts`) + status machine (`config/public/bgmi-lab.ts`) + exactly one drill logic (Circle IQ `circle-iq-logic.ts` or Loot Dash `loot-dash-sim.ts`, rewritten). Ephemeral, no persistence/leaderboards.

## 9. `src/features/player-profile/` (existing, frozen)

- No G1 edits. Future `team_members(user_id)`, `organization_members(user_id)`, `brand_representatives(user_id)` FK to `app_users(id)` may reference identity (per `player-profile/README.md:91-94`). Verification stays forbidden.

## 10. `src/server/` (privileged)

- REIMPLEMENT: `recordAdminAudit` + `safeAuditProjection` + `is_super_admin` gate; `recordCronRunStart/Complete` ledger; entitlement-check shape (`has_tool_access` → fresh function). All with fresh RLS + service-role discipline. Never import legacy `server/*` files.

## 11. `src/lib/` (shared pure utilities)

- PORT candidates only after de-coupling from legacy imports: roster `normalize.ts` (zero deps), search-param parsers (after removing `@/lib/validation` coupling), share-URL builder, safe-fetch primitive. Each must pass a purity check (no react/supabase/fetch-random/Date/log) mirroring `purity.test.ts`.

## 12. Explicitly no destination (REJECT/DEFER stays out)

Draft-Ban/Tie-Breaker/Payout/Prize engines, VOD-Clipper/Scrim-Matchmaker/Roster-Sentinel, qualification simulator product, legacy prices/plans, legacy `finder_*`/`bgmi_*`/`meta_parser_*`/`sponsor_*` tables, legacy RLS files, provider SDK deps — no greenfield home.
