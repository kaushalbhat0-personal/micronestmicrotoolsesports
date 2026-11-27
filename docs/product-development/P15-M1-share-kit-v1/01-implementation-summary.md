# 01 — Implementation Summary

## Preflight

| Check | Result |
|---|---|
| Branch | `new-platform` |
| HEAD | `890e16cbab0ecc03c2e562e9fe18915bca5e9eff` |
| Preserved worktree | Untracked P14-D14 + P15-A0 docs kept |
| Audit vs source mismatches | See below |

### Audit ↔ source mismatches recorded

1. **PNG library:** P15-A0 suggested optional `html-to-image`. Implemented **Canvas 2D** with zero new npm dependencies (Next 16 / React 19 safe, license-clean).
2. **Roster CSV:** Audit mentioned `features/teams/roster/output.ts` (D1 `WorkingTeam` model). Tools roster uses a different state shape — added `buildToolsRosterCsv` in `features/tools/share/roster-card.ts` instead of forcing the wrong helper.
3. **Team public `id`:** `PublicTeamCard` includes `id`; share models **omit** it so UUIDs never enter PNG props.

## Features implemented

1. Shared Share Kit (`src/lib/share-kit`) — 1080×1080 Arena canvas, watermark, fonts, sanitize, download, errors.
2. `ShareDownloadButton` — loading / success / error + `aria-live`.
3. Prize Pool PNG + **inline catch** of `PrizePoolError` (over-allocation) without changing engine math.
4. Roster PNG + **Download CSV**.
5. Tie-Break PNG with simulation disclaimer (no official PMGC claims).
6. Player public profile PNG from frozen projection only (“Discoverable Player”).
7. Team public PNG; “Open to Recruitment” only when `recruiting === true`.
8. `/campaigns/bgmi-season` toolkit landing + footer link; `robots: noindex`.

## New dependencies

**None.** Canvas 2D + existing Oswald/Geist font stacks.

## PNG generation approach

Declarative `ShareCardSpec` → `renderShareCardBlob` draws carbon background, crimson keyline, MicroNest mark (icon.svg geometry), rows/blocks, disclaimer, watermark bar with destination URL → `blob` → `<a download>`.

## Files touched (primary)

| Area | Paths |
|---|---|
| Foundation | `src/lib/share-kit/*` |
| UI | `src/components/shared/share-download-button.tsx` |
| Tools share | `src/features/tools/share/*` |
| Tool runners | `prize-pool-runner.tsx`, `roster-builder-runner.tsx`, `tiebreak-runner.tsx` |
| Player | `share/player-card-model*`, `player-share-card.tsx`, `players/[handle]/page.tsx` |
| Team | `share/team-card-model*`, `team-share-card.tsx`, `teams/[slug]/page.tsx` |
| Landing | `src/app/campaigns/bgmi-season/*` |
| Footer / marketing test | `site-footer.tsx`, `marketing.test.tsx` |
| Docs | `docs/product-development/P15-M1-share-kit-v1/*` |
