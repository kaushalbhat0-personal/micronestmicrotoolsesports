# 04 — Finder Domain Contracts (GATE D1.4)

## Sources inspected (reference only)

`domain/levels.ts` · `roles.ts` · `matching.ts` · `schemas/finder.ts` · `repositories/finder.ts` · `services/{team-service,recruitment-service,application-service,player-search,team-search,fit-reasons,team-logo-service}.ts`

## Greenfield contracts (D1)

- `src/features/teams/domain/levels.ts` — 6-step self-reported levels, `LEVEL_WINDOW_BELOW=1`, `meetsLevelMinimum`. REIMPLEMENT verbatim.
- `src/features/teams/domain/roles.ts` — `SUPPORTED_GAMES=['bgmi']`, `BGMI_ROLES`, `GAME_ROLES`, `isSupportedGame/isRoleForGame`; `normalizeRegion/regionsCompatible` preserved for reference but new code MUST use vocabulary-checked `region_code` (G1 BGMI set).
- `src/features/teams/domain/matching.ts` — `hardFiltersPass` (same game, open, looking-for, region, role∈{primary+secondary}, level window) + `rankMatch` → `strong/good/stretch/no-match`, factual reasons. No percentages. Callers MUST pass `verified=false`, `tournamentEvidenceCount=0` until verification exists.
- `src/features/teams/schemas/team.ts` — team (slug 2–60 hyphen, `gameKey:'bgmi'`, BGMI `regionCode`, levels, recruiting/isPublic), `teamUpdateSchema` (no slug/game takeover), `memberRoleSchema` (captain/co-captain/player/sub), recruitment (role, slots 1–10, levels, region, status, expiresAt), application (note ≤200), decision (`shortlisted|accepted|declined`), report (target enum, uuid, reason 10–1000). No `character_id`/`game_user_id` (D-G1-04).
- `src/features/teams/services/search.ts` — `parseTeamSearchParams` (`recruitingOnly` default, `recruiting=0` opt-out), `parsePlayerSearchParams`; unknown enums ignored, vocabulary-checked, caps (region 40, q 60), limit 60.

## Product decisions (D1, see 09)

1. Team identity: `slug` unique + `name`; one team = one `game_key` (D1).
2. Independence: teams independent; `organization_id` reserved text (no FK) for future org ownership.
3. Membership: `PK(team_id,user_id)` — one user MAY belong to many teams.
4. Permissions: creator is owner + captain; captain = `owner_user_id`|`created_by` or member `captain`. Co-captain has no captain rights in D1.
5. Roster/game: `game_role` nullable per member; team game fixed at creation.
6. Recruitment: captain-gated CRUD/status; `expires_at` default +30d.
7. Applications: partial unique `(post,applicant)` where active; withdraw owner-only (`applied|shortlisted→withdrawn`); `accepted` auto-adds `player` roster row (app layer, idempotent); `shortlisted` never touches roster; cross-team isolation.
8. Masked discovery: RPC-only (`search_teams`, `get_team_by_slug`), bounded pagination (≤60), generic errors, no PostgREST bypass, no `owner_user_id`/`created_by`/`organization_id` in projection.
9. Duplicates: slug conflict → conflict error; application duplicate → conflict error.
10. Authorization: session-derived `auth.uid()` only; RLS + `is_team_member/captain()` helpers; no user-ID args.
11. Organizations/brands: designed for, not built.

## Boundaries enforced

No multi-team-per-user ban invented; no multi-game teams; no org-grants-team-control; no legacy captain rules copied; no free-text region matching in new validation; no auto-matching scores (tiers only).
