# P2 Server Integration Plan

The workspace is code-complete against the D1 contract and gated in three
places. Enabling liveness is a checklist, not a redesign.

## Gate 1 — Migration acceptance + application (owner flow, NOT this phase)

- Accept D1 sequence + D1.6.1 corrective migration (decision register +
  technical blockers register).
- Apply via the authorized owner flow. No resets, no destructive cleanup.

## Gate 2 — Direct PostgREST verification (before any UI flip)

- `teams` select as owner / creator / member / outsider / anon (RLS
  `teams owner select`); `team_members` select as member / outsider;
  count queries; limit/offset behavior.
- Confirm invisible→zero-rows for outsiders (the null-mapping contract).
- Confirm `is_team_captain` / `is_team_member` helper behavior for
  owner / captain / co-captain (rightless) / plain member / suspended.

## Gate 3 — Flip + verify (the only code change)

1. Set `WORKSPACE_WRITES_ENABLED = true` in
   `src/features/teams/server/workspace-writer.ts` AND update the static
   gate test in `src/app/workspace/teams/routes.test.ts` (it breaks on
   purpose until both change together).
2. Wire `actions.ts` to call `createTeamOp` / `updateTeamSettingsOp`
   after validation (two call sites; session already checked).
3. Run the database authorization matrix: owner insert; non-owner update
   denied; suspended insert/update denied; anon denied; forged
   owner_user_id rejected at validation AND at RLS; slug/game-key update
   rejected at trigger; duplicate slug → validation message (23505).
4. Re-record `07-test-evidence.md` live table with real rows at 360/1280px.
5. Marketing follow-up unchanged from P1 (RoadmapStrip + footer copy
   reword only after liveness).

## Deliberately out of the flip

Captain decisions, roster insertion/deletion RPCs, ownership transfer,
organization authority, report surfaces, recruitment writes — each needs
its own decision + RPC design (P3 scope). The flip enables creation +
editable-field updates only.
