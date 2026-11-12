# A1 — Legacy Capability Extraction & Retirement Blueprint

**Branch:** `new-platform` | **Date (UTC):** 2026-11-11 | **Mode:** planning + source inspection only — no modifications, migrations, DB changes, deletions, or legacy imports.
**Inputs:** `docs/product-discovery/A0-codebase-audit/` (esp. 02, 07, 09, 11, 12). G1-1..G1-7 remain authoritative and frozen.
**Archive:** `ref/legacy-project/` (1299 files) — read-only reference until retirement gates pass.

## Verdict: CONDITIONAL READY

Extraction blueprint is complete and actionable. Proceed to phased extraction in roadmap order. Condition: every PORT/REIMPLEMENT requires fresh security review (auth/RLS/service-role) and product approval (pricing/copy/scope) before use; no legacy migration, auth module, RLS file, price, or plan may be restored automatically.

## Highest-value extraction candidates

1. **Roster pure services** — `features/roster-builder/services/{normalize,parser,conflicts,slots,output}.ts` — PORT. Deterministic, zero-dependency, heavily tested parsing/normalization/conflict/slot logic for organizer intake.
2. **Finder discovery contracts** — `features/finder/domain/{levels,roles,matching}.ts` + `services/{player-search,team-search,fit-reasons}.ts` + `schemas/finder.ts` + `repositories/finder.ts` masked-view pattern — REIMPLEMENT (domain) / DOCUMENT (rules). Closest ancestor for teams/opportunities/applications; never migrate `finder_*` tables.
3. **Tournament ingest observability** — `features/bgmi-tournaments/services/{ingest,validate,points,standings}.ts` + `adapters/{liquipedia,safe-fetch}.ts` + `app/api/ingest/bgmi-tournaments/route.ts` + workflows — DOCUMENT + REIMPLEMENT pattern. Validate-before-publish + body-gated `ok:false` contract for editorial tournament/news ingestion.
4. **Meta-Parser pipeline pattern** — `features/meta-parser/services/{safe-fetch,sanitize,entity-normalize,numeric-extract,direction-map,health,ingest,conflict}.ts` + `adapters/registry.ts` — REIMPLEMENT. Safe-fetch + sanitization + health pattern for news/tournament editorial workflows.
5. **BGMI Lab island + share pattern** — `features/bgmi-lab/games.tsx` + `share-result-url.ts` + `share-message.ts` + 1 drill logic (Circle IQ or Loot Dash) — REIMPLEMENT. Loader/island + ephemeral + challenge-banner pattern for Phase 7 (1–2 drills only).
6. **Billing verification primitives** — `server/billing/{dodo,razorpay,verify-service,checkout-service,expiry,period}.ts` + `server/webhooks/verifier.ts` + `complete_*_payment` RPC pattern — DOCUMENT + REIMPLEMENT when D-10/D-17 approved. HMAC, timestamp, idempotency, server-authoritative pricing.
7. **Admin/audit/ledger pattern** — `server/admin/{platform-admins,audit,audit-log}.ts` + `server/cron/run-ledger.ts` + `is_super_admin`/`is_org_member` helper shape — REIMPLEMENT. Append-only logs + ledger + super-admin gate for verification/review queues.
8. **Game catalog static pattern** — `config/games/catalog.ts` (10 slugs + alias map) — REIMPLEMENT. Pure lookup pattern; redesign BGMI-first slugs.

## Proposed greenfield destinations (planning only)

- `src/features/teams/` ← Finder team formation + captain guards (REIMPLEMENT)
- `src/features/organizations/` ← org membership/role shape + roster intake (REIMPLEMENT)
- `src/features/brands/` ← Sentinel evidence concepts only (DOCUMENT, DEFER build)
- `src/features/opportunities/` ← Finder recruitment/application lifecycle (REIMPLEMENT)
- `src/features/tournaments/` ← ingest observability + roster pure services for organizer intake (REIMPLEMENT)
- `src/features/news/` ← Meta-Parser pipeline pattern (REIMPLEMENT)
- `src/features/tools/` ← roster pure services as first free-tool logic (PORT); billing rails deferred (DOCUMENT)
- `src/features/mini-games/` ← BGMI Lab island/share pattern, 1 drill (REIMPLEMENT)
- `src/features/player-profile/` ← extend only via `team_members`/`organization_members` FK notes; no G1 modification
- `src/server/` ← audit/ledger/admin-gate/entitlement-check shapes (REIMPLEMENT, fresh RLS)
- `src/lib/` ← pure utilities only (normalize, share-URL, safe-fetch primitives) after de-coupling

No empty modules to be created now.

## Security / dependency risks (summary)

Legacy assumes org-tenancy (`is_org_member`), service-role writes, Vercel cron + `CRON_SECRET`, OAuth creds (Twitch/YouTube/Kick), provider API keys, `DODO_*`/`RAZORPAY_*` secrets, storage buckets `finder-avatars`/`finder-verification`. All must be redesigned: session-derived identity only, fresh RLS, no copied policies, no restored migrations, no live secrets carried over. Full review: `04-security-and-dependency-review.md`.

## Deferred / rejected

- **DEFER:** Sentinel full build, VOD automation, billing activation, workspace analytics, brand evidence collection — valuable but not in Discovery MVP.
- **REJECT:** Draft-Ban / Tie-Breaker / Payout-Tracker / Prize-Splitter engines, VOD-Clipper / Scrim-Matchmaker / Roster-Sentinel, auto-matching scores, qualification simulator as product, legacy prices/plans. See `02`.

## Extraction order

Discovery MVP (roster pure + finder contracts + catalog + admin/ledger shape) → Tournaments (ingest observability) → News (meta-parser pattern) → Free tools (roster PORT) → Mini-games (1 drill) → Paid/billing + Sentinel (only after D-10/D-17 + brand pillar approval). No extraction blocks product start. See `05`.

## Deletion prerequisites

All PORT/REIMPLEMENT accepted + independently tested, rules documented in `07`, no imports/dependencies/migration references, env reviewed, historical evidence retained outside archive, product-owner sign-off. See `06`.

## Document index

- `01-exact-legacy-source-map.md` — exact paths, functions, rules, deps, tests
- `02-capability-extraction-register.md` — PORT/REIMPLEMENT/DOCUMENT/REJECT/DEFER decisions
- `03-greenfield-destination-map.md` — planning destinations
- `04-security-and-dependency-review.md` — imports, DB, auth, RLS, secrets, cron
- `05-extraction-sequence.md` — roadmap-aligned order
- `06-retirement-acceptance-gates.md` — deletion gates + surviving docs
- `07-preserved-domain-knowledge.md` — rules/algorithms to keep
