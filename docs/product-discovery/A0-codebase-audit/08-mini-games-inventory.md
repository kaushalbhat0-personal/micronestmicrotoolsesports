# 08 — Mini-Games Inventory

## 1. Greenfield: ABSENT

- No game implementations, engines, browser games, Godot/Unity/Phaser integration, assets, score systems, leaderboards, or multiplayer infrastructure.
- `public/` contains only `.gitkeep` — no game assets/banners/OG images.
- Repo-wide glob `**/*.{godot,pck,wasm,tscn,gd}` = 0 hits. Grep `godot|unity|phaser|leaderboard|highscore|multiplayer|/games|/tools|/mini|/bgmi-lab` in `src/` = only `features/README.md:4` + `about/page.tsx:59` + `roadmap-strip.tsx:13` (Coming soon labels).
- `src/features/` has only `player-profile/` + `README.md`; no `engines/` or `games/` feature.
- Spec-only (deferred Phase 7): `mvp-roadmap.md:60-65` (reuse BGMI Lab / Loot Dash concepts behind profile-linked engagement; no new games; activity is soft signal, never score), `scope-freeze-proposal.md:30-33` (nothing until discovery proves out; no new games, leaderboards-as-identity, prizes), `repository-and-service-architecture.md:11` (reserves `engagement` module, empty).

## 2. Legacy: BGMI Lab — working browser mini-games (reference-only)

- **Registry:** `ref/legacy-project/application/src/config/public/bgmi-lab.ts:77-501` — 8 entries: available `circle-iq`, `igl-decision-drill`, `zone-patterns`, `rotation-replay`, `tournament-scenario-generator`, `loot-dash`; planned `rotation-iq`, `final-circle`, `lift-the-trophy`.
- **Loader:** `features/bgmi-lab/games.tsx:44-52` — `dynamic()` islands (`CircleIqIsland`, `LootDashIsland`, `RotationReplayIsland`, `TournamentScenarioGeneratorIsland`, `ZonePatternExplorerIsland`, `IglDecisionIsland`).
- **Routes:** `app/bgmi-lab/page.tsx`, `app/bgmi-lab/[slug]/page.tsx` (available only, routable/sitemap).
- **Shells:** `components/marketing/bgmi-lab/game-page-shell.tsx`, `ad-safe-game-layout.tsx`, `game-faq.tsx`, `related-lab-games.tsx`; tournament-derived data `features/bgmi-lab/data/tournament-scenarios.ts`.
- **Mechanics (ephemeral):** `bgmi-lab.ts:108,456` — score is ephemeral, nothing saved, no leaderboard. Loot Dash: 45s, 360×480 arena, WASD/arrows/drag, supplies 10pts / caches 25 / medkit 5or15, combo +2/step within 4s, 3 lives. Circle IQ 8 rounds, IGL Drill 6 scenarios.
- **Tests:** `bgmi-lab.test.ts` (no plan/price fields), `circle-iq-*.test.tsx`, `loot-dash`/`igl`/`rotation`/`zone`/`scenario` tests (no `fetch`/analytics/leaderboard — enforced).
- **Qualification Simulator:** `features/bgmi-qualification/` client-only points-race calculator (not Smash-rule final), local-only, no auth/DB.

## 3. Maturity + reuse

| Item | Maturity | Recommendation |
|---|---|---|
| Greenfield mini-games | Absent | Build only after discovery proves out (Phase 7) |
| BGMI Lab drills | Prototype/working (React islands, ephemeral) | ADAPT loader/island + share-URL/challenge-banner + FAQ/related-games patterns; REBUILD content for new IA; never import |
| Scores/leaderboards/multiplayer/Godot | Nonexistent | Do not expand into game-development project during audit; leaderboards-as-identity and prizes explicitly out of scope |
