# 08 — Legacy Extraction Register (D1)

| Legacy source | Greenfield destination | Adaptation | Removed deps | Tests | Acceptance |
|---|---|---|---|---|---|
| `features/roster-builder/services/normalize.ts` | `src/features/teams/roster/normalize.ts` | Verbatim logic; ascii-safe regex | None (was pure) | `roster/tests/normalize.test.ts` | PASS |
| `.../services/parser.ts` | `.../roster/parser.ts` | Locale-independent counts; zod v4 schemas | Legacy type import shape | `.../parser.test.ts` | PASS |
| `.../services/conflicts.ts` | `.../roster/conflicts.ts` | Verbatim rules | None | `.../roster.test.ts` | PASS |
| `.../services/slots.ts` | `.../roster/slots.ts` | Verbatim | None | `.../roster.test.ts` | PASS |
| `.../services/output.ts` | `.../roster/output.ts` | Verbatim (contacts excluded) | None | `.../roster.test.ts` | PASS |
| `.../types/index.ts` | `.../roster/types.ts` | Verbatim caps | None | via above | PASS |
| `.../schemas/index.ts` | `.../roster/schemas.ts` | zod v4 signatures | Billing/policy coupling | `.../roster.test.ts` | PASS |
| `.../services/whatsapp.ts` + `@/lib/share/whatsapp` | — (not carried) | — | WhatsApp budget→future UI decision | — | DOCUMENTED |
| `server/services/roster-builder-policy.ts`, `actions/claim-actions`, UI | — (not carried) | — | Entitlement/billing/UI | — | DOCUMENTED |
| `config/games/catalog.ts` | `src/lib/game-catalog/catalog.ts` | BGMI-only + planned MLBB; alias set aligned to DB seed | 9 legacy slugs, MLBB enablement | `catalog.test.ts` | PASS |
| `server/admin/{platform-admins,audit,audit-log}.ts`, `server/cron/run-ledger.ts` | `src/server/admin/audit.ts` (pure) + `20261112000001` migration (pending) | Pure validators only; DB fresh (app_users FK, no profiles copy) | Service-role/RPC/dashboard | `audit.test.ts` | CONDITIONAL (code PASS, DB pending) |
| `features/finder/domain/{levels,roles,matching}.ts` | `src/features/teams/domain/*` | Verbatim + region-vocab note + verification-deferred note | DB/views | `teams-domain.test.ts` | PASS |
| `features/finder/schemas/finder.ts` | `src/features/teams/schemas/team.ts` | G1-aligned (no game_user_id, BGMI vocab, one-game teams) | character_id, free-text regions | `teams-domain.test.ts` | PASS |
| `features/finder/services/{player-search,team-search}.ts` | `src/features/teams/services/search.ts` | Vocabulary-checked, BGMI-fixed | Legacy validation lib | `teams-domain.test.ts` | PASS |
| `features/finder/services/{team,recruitment,application,fit-reasons,team-logo}-service.ts`, `repositories/finder.ts` | `20261112000002` migration + `04` contracts (pending) | Fresh tables/RLS/RPCs, never migrate `finder_*` | Org/entitlement/storage coupling | Design only | CONDITIONAL (pending apply) |
| Billing, Sentinel build, Draft/Tie/Payout/Prize, VOD automation, qualification product, legacy prices/plans | — | — | — | — | REJECT/DEFER per A1 (no action) |

No imports from `ref/legacy-project/` in `src/` (enforced by `tsconfig` exclude + `src/features/teams/README.md`).
