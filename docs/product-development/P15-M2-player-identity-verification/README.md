# P15-M2A — Player Identity, Discoverability & BGMI Verification Architecture

**Milestone:** Architecture-only (no implementation)  
**Branch:** `new-platform`  
**HEAD inspected:** `890e16c`  
**Supabase project:** `knniommcyyhbyiwljisk` (Esports only)  
**Mode:** Documentation under `docs/product-development/P15-M2-player-identity-verification/`

## Verdict

**CONDITIONAL PASS**

The repository was inspected (application + migrations + Share Kit + admin foundations). An implementable architecture exists that reuses G1 identity, the existing `private-verification` bucket, and `platform_admins` / `is_super_admin()` without widening the frozen 12-field public projection. Discord should be **deferred** while remaining explicitly optional. Owner approval is still required for a small set of open product decisions (completeness gate vs current consent RPC, public badge channel, BGMI ID format confirmation).

## Locked product decisions (final)

1. **Discord is OPTIONAL** — never required for registration, profile completion, or discoverability. Proves Discord account control only; never BGMI ownership.
2. **Discoverability requires a COMPLETE profile + explicit opt-in.** Completeness ≠ discoverability ≠ verification badge. Badge is **not** required for directory visibility. Do not silently weaken existing consent semantics.
3. **BGMI verification is MANUAL** — player submits evidence; authorized reviewers decide; only approval grants a badge. Separate from completeness and discoverability. Never claim official BGMI/Krafton verification.

## Scope

| In | Out |
|---|---|
| Architecture + threat model + data/RLS/Storage design | Feature implementation |
| Work-package plan for M2B.* | Migrations / RLS apply / Storage apply |
| Discord design or justified deferral | Production Auth/dashboard changes |
| Share Kit privacy rules | Team roster identity cards |

## Recommendation (executive)

1. **Reuse** `player_profiles` / `player_game_profiles.game_user_id` / `public-avatars` / `private-verification` / `platform_admins`.
2. **Ship profile edit UI** for fields already in schema (IGN, role, region, modes, availability, private BGMI ID, avatar) before inventing new identity columns.
3. **Gate discoverability** server-side: completeness check inside/alongside `set_player_discoverability` (explicit product change; document rollback).
4. **Add** private submission + evidence metadata + append-only review audit; public surface = minimal boolean/flag via a **separate** DEFINER read — **do not** add private fields to the frozen 12-column RPCs.
5. **Reviewers** = `is_super_admin()` (smallest secure approach); no client-side role flags.
6. **Defer Discord OAuth** until after M2B.1–M2B.4; keep policy text “optional, never required.”

## Deliverables

| # | File |
|---|---|
| 1 | `README.md` (this file) |
| 2 | `01-current-state-audit.md` |
| 3 | `02-player-identity-and-discoverability.md` |
| 4 | `03-verification-workflow.md` |
| 5 | `04-security-threat-model.md` |
| 6 | `05-data-model-and-rls-design.md` |
| 7 | `06-discord-integration-design.md` |
| 8 | `07-share-kit-and-privacy.md` |
| 9 | `08-implementation-plan.md` |
| 10 | `09-acceptance-criteria.md` |
| 11 | `10-open-decisions-and-risks.md` |

## Legend used across docs

- **Verified** — inspected in this repo/migrations.
- **Proposed** — architecture for future M2B implementation.
- **Unverified / Open** — needs owner confirmation or external provider fact.

## Implementation follow-ups

- **M2B.1** (implemented, uncommitted): `M2B.1/` — profile editing + D-G1-08 completeness enforcement. Hosted migration applied on Esports `knniommcyyhbyiwljisk`.
- **M2B.2** (implemented, uncommitted): `M2B.2/` — private BGMI Player ID via reused `game_user_id`; no new migration.
