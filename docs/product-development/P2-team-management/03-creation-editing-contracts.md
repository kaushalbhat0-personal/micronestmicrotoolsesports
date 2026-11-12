# P2 Team Creation and Editing Contracts

## Creation (`/teams/new` + `createTeamAction` + `createTeamOp`)

- Fields: slug, name, `gameKey` (single, BGMI today), regionCode (BGMI
  vocabulary), current/target levels (self-reported), description (≤1000),
  recruiting + visibility flags — the D1 `teamSchema` field set.
- Contract: `createTeamInputSchema = teamSchema.strict()`. Forged
  `owner_user_id` / `created_by` / `organization_id` keys are REJECTED
  (validation error), never silently dropped — proven in
  `workspace-writer.test.ts` and `route-lib.test.ts`.
- Ownership assignment is session-derived (`owner_user_id = created_by =
  auth user`) in the below-gate statement. There is no input path for
  ownership, by construction.
- Slug/game permanence is stated in UI copy (slugs permanent, one game per
  team) matching the immutable-column trigger design.
- Today: validate → session check → `WorkspaceDisabledError`. Zero table
  touches (fake-client call log assertion). No fake success.

## Editing (settings route + `updateTeamSettingsAction` + `updateTeamSettingsOp`)

- Editable (exactly the D1.5.1 column-grant list): name, region_code,
  current_level, target_level, description, recruiting, is_public.
- Protected: `id`, `owner_user_id`, `created_by`, `game_key`, `slug`,
  `organization_id`, timestamps.
- Contract: `{ teamId: uuid, patch: teamUpdateSchema.strict() }`. Smuggled
  slug/game/owner/org keys fail validation — proven in tests. The update
  statement below the gate lists editable columns explicitly (no spread,
  no mass assignment).
- Presentation: slug/game/id render as locked read-only values; owner and
  org fields have NO inputs at all. Members get no form.
- Immutability defense in depth (migration-side, unchanged): column-level
  UPDATE grants + `enforce_teams_immutable_columns` trigger. P2 adds the
  application-side strict-schema layer; it does not weaken or duplicate
  the database layer.
- Ownership transfer: no UI, no action, no RPC — matrix edge cases
  (suspended owner freeze, RESTRICT stranded teams) are stated in
  `PermissionNote`, not implemented around.
