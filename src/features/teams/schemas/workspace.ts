// P2 workspace Zod boundaries (creation + settings contracts).
// - Creation reuses the D1 `teamSchema` fields, made .strict() so
//   protected keys (owner_user_id, created_by, organization_id, …) are
//   rejected at validation — never silently dropped.
// - Settings patch reuses `teamUpdateSchema` (name, region, levels,
//   description, recruiting, visibility — exactly the D1.5.1 column-grant
//   list), made .strict() so slug/gameKey/ownership/org keys are rejected.
//   The team row id travels as a separate uuid field, never inside the patch.

import { z } from "zod";
import { teamSchema, teamUpdateSchema } from "./team";

export const managedTeamIdSchema = z.string().uuid();

export const createTeamInputSchema = teamSchema.strict();

export type CreateTeamInput = z.infer<typeof createTeamInputSchema>;

export const updateTeamSettingsSchema = z
  .object({
    teamId: managedTeamIdSchema,
    patch: teamUpdateSchema.strict(),
  })
  .strict();

export type UpdateTeamSettingsInput = z.infer<typeof updateTeamSettingsSchema>;
