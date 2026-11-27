# D1 — Discovery MVP Foundation & Legacy Extraction

**Branch:** `new-platform` | **Date (UTC):** 2026-11-11
**Mode:** implementation. No commits, pushes, deployments, deletions. No `ref/` imports. No legacy migration restore.
**Supabase:** primary `knniommcyyhbyiwljisk` verified read-only (4 tables, 9 migrations). Sibling never accessed. No remote writes in D1 — new migrations are local design artifacts pending acceptance.

## Verdict: CONDITIONAL PASS

Independent gates pass (pure logic, catalogue, domain contracts, designs, 308 tests, typecheck, lint, build). Domain decisions + DB/security acceptance remain (migrations pending review, no remote apply).

## Implemented functionality

- **Roster pure extraction (GATE D1.1):** `src/features/teams/roster/{types,normalize,parser,conflicts,slots,output,schemas}.ts` + 3 test files. Deterministic, stateless, DB/auth/billing-free. WhatsApp workflow, entitlement gates, and roster UI intentionally not carried forward.
- **Game catalogue (D1.2):** `src/lib/game-catalog/catalog.ts` — BGMI-only supported, MLBB planned-but-rejected, alias normalization, G1 `games(key)` compatible. No G1 change.
- **Admin/audit foundation (D1.3):** `src/server/admin/audit.ts` pure primitives (action/target validation, reason, UUID, forbidden-key scan, safe projection, ledger ID checks) + tests. Full design in `03`; migration `20261112000001_d1_admin_foundation.sql` pending (not applied).
- **Finder domain (D1.4):** `src/features/teams/domain/{levels,roles,matching}.ts`, `schemas/team.ts` (G1-aligned, no `game_user_id`), `services/search.ts` (vocabulary-checked parsers) + tests. No scores, no free-text regions, no verification claims.
- **Database/security (D1.5):** designs + 2 local migrations (admin + teams/discovery with RLS/RPC/grants). Not applied; verified no conflict with live 4-table state.

## Test results

`npm test`: 31 files / 308 tests pass (incl. 43 new D1 tests, all G1 regression green). `npm run typecheck`, `lint`, `build` pass. No remote writes; no user data touched.

## Unresolved decisions

Team multi-membership allowed; one team = one game; captain = owner/creator or `captain` role; org ownership reserved (`organization_id` text, no FK); region = BGMI vocabulary; free-text matching rejected; auto-scores forbidden; verification deferred; billing deferred. Full brief in `09`.

## Next phase

Accept D1 migrations via security review, apply to primary, then build server operations (session-derived) + masked RPC reads + application lifecycle integration tests.

## Index

- `01-roster-extraction.md` · `02-game-catalogue.md` · `03-admin-audit-design.md`
- `04-finder-domain-contracts.md` · `05-discovery-database-design.md` · `06-security-and-rls-review.md`
- `07-test-evidence.md` · `08-legacy-extraction-register.md` · `09-remaining-product-decisions.md`
