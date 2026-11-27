# A0 — Full Codebase, Legacy & Product Capability Audit

**Branch:** `new-platform`
**Date (UTC):** 2026-11-11
**Mode:** Read-only audit. No source, migration, dependency, or database changes made.
**Supabase scope:** Primary project `knniommcyyhbyiwljisk` only (read-only). Sibling `iwgefthgciddukqabkun` never accessed.

## Verdict: CONDITIONAL PASS

Audit is complete. Repository and legacy landscape are sufficiently understood for planning. Conditional because deployment history, production data volumes, and legacy billing live-status could not be verified from read-only evidence and remain documented unknowns.

## Repository condition

- **Greenfield is small, clean, and isolated.** Active app is `src/` (113 files), `supabase/` (9 migrations), `e2e/`, `docs/`. `tsconfig.json` excludes `ref/**`. No imports from `ref/` (enforced by `src/features/README.md` and `docs/audits/g02-foundation-acceptance/report.md`).
- **Legacy is preserved, not deleted.** Full pre-greenfield platform archived at `ref/legacy-project/` (1299 files, ~11.4 MB): `application/` (1226 files), `supabase/` (60 files, 58 migrations), `toolchain/`, `deployment/`. Rules in `ref/legacy-project/README.md`: read-only reference, no imports.
- **Working tree has pre-existing modifications** (verified `git status`): modified `.gitignore`, `e2e/home.spec.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/shared/*`, `src/config/site.ts`, plus untracked G1/marketing work (`src/app/about/`, `src/app/players/`, `src/app/settings/`, `src/features/player-profile/`, 7 untracked migrations). Audit did not touch them.
- **Backend is minimal and live-verified.** Primary Supabase project contains exactly 4 public tables (`app_users`, `player_profiles`, `games` with 1 row, `player_game_profiles`), 7 public RPCs, 3 storage buckets. Zero billing/entitlement/tournament/news/teams/orgs/brands tables. See `01-repository-architecture.md`.

## Main findings

1. **Genuinely implemented (greenfield):** Supabase Auth identity anchor + `ensure_app_user`, canonical player profiles, BGMI game profiles, public directory (`/players`) + profile pages (`/players/[handle]`) via RPC-only projection, avatar management, discoverability + per-game visibility + handle lifecycle + owner deletion. Marketing M0/M1/M2/M4 (homepage + about, competitive-esports visual identity, responsive/a11y/perf validation). Evidence in `03-current-product-capabilities.md`.
2. **Legacy subsystems discovered (all archived):** Sponsor-Sentinel, Prize-Splitter, Draft-Ban, Tie-Breaker, Payout-Tracker, Roster-Builder, Finder (players/teams/recruitment), BGMI Tournament Hub, BGMI Lab (6 available drills), BGMI Qualification Simulator, Meta-Parser, Dodo+Razorpay billing rails. See `02-legacy-code-inventory.md` and `07-free-paid-tools-inventory.md`.
3. **Free tools:** No free tools in greenfield. Legacy free/unmetered: Roster-Builder (stateless, no plans), Prize-Splitter free tier (unlimited), BGMI Lab drills (open, ephemeral), Qualification Simulator (local-only). All archived, not current.
4. **Paid tools:** No paid tools or pricing in greenfield. Legacy paid (archived, INR+USD documented in migrations): Sponsor-Sentinel, Prize-Splitter, Draft-Ban, Tie-Breaker, Payout-Tracker, All-Access bundle. Do not carry prices forward.
5. **Billing/entitlements:** Absent in greenfield (`package.json` has no `dodopayments`/`razorpay`; `supabase/` has no billing tables/RPCs; `.env.example` has only Supabase + app URL names). Fully implemented in legacy archive (Razorpay + Dodo, `complete_billing_payment` / `complete_dodo_payment`, webhook idempotency, free-claim grants). See `07`.
6. **Tournaments:** Absent in greenfield (spec-only, Phase 6). Legacy BGMI hub was working (Liquipedia ingest + standings) but explicitly out-of-scope/dormant for new product. See `05`.
7. **News:** Absent (spec-only, Phase 5). No CMS, no tables, no routes. Legacy had only static marketing guides/glossary, not a news system. See `06`.
8. **Mini-games:** Absent in greenfield (deferred Phase 7). Legacy BGMI Lab = working browser React islands, ephemeral scores, no persistence/leaderboards/multiplayer/Godot. See `08`.
9. **Reuse:** Identity anchor, admin/audit/ledger pattern, storage bucket pattern — REUSE. Game catalog, finder masked views, roster parse/normalize, meta-parser pipeline, tournament ingest observability, BGMI Lab share-URL pattern, billing rails — ADAPT. Sponsor-Sentinel + VOD automation — REBUILD. Draft/Tie/Payout/Prize engines — RETIRE (dormant). See `11-reuse-rebuild-retire-matrix.md`.
10. **Critical gaps:** No teams/orgs/brands/opportunities domain models; no roles beyond `app_users.status`; no moderation/verification/entitlement/content/notification/audit systems in greenfield; marketing correctly shows only Discover live. See `04`, `09`, `10`.

## Recommended next action

Proceed to Master Product Blueprint using `12-master-product-roadmap-input.md` as evidence input. Do not restore legacy migrations, auth code, RLS, or pricing without fresh security/product review. Resolve documented unknowns (deployment proof, live-row counts beyond public tables, billing live-status, YouTube webhook token) before any reuse decision.

## Document index

- `01-repository-architecture.md` — current architecture + route inventory
- `02-legacy-code-inventory.md` — legacy subsystems + classification
- `03-current-product-capabilities.md` — implemented features + evidence
- `04-discovery-ecosystem-gap-analysis.md` — players/teams/orgs/brands
- `05-tournament-domain-audit.md` — tournament capability + gaps
- `06-news-editorial-audit.md` — news capability
- `07-free-paid-tools-inventory.md` — complete tools + billing evidence
- `08-mini-games-inventory.md` — game implementations
- `09-cross-cutting-architecture.md` — identity/security/billing/moderation
- `10-marketing-product-alignment.md` — claims vs readiness
- `11-reuse-rebuild-retire-matrix.md` — consolidated recommendations
- `12-master-product-roadmap-input.md` — blueprint inputs
