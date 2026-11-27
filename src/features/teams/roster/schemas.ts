// D1 roster intake — zod boundaries (PORT from legacy schemas, entitlement-free).
// Legacy: legacy/application/src/features/roster-builder/schemas/index.ts
// Removed: nothing structural. No billing/policy coupling in D1.
import { z } from "zod";
import { MAX_INPUT_CHARS, MAX_TEAM_CAPACITY, MAX_TEAM_NAME_LENGTH, MAX_PLAYER_NAME_LENGTH, MIN_TEAM_CAPACITY } from "./types";

export const delimiterSchema = z.enum(["\t", ",", ";", "|"]);

export const pastedInputSchema = z
  .string()
  .min(1, "Paste at least one registration line to clean a roster")
  .max(MAX_INPUT_CHARS, `Pasted input is too large (maximum ${MAX_INPUT_CHARS} characters)`);

export const teamCapacitySchema = z
  .number()
  .int("Team size must be a whole number")
  .min(MIN_TEAM_CAPACITY, `Team size must be at least ${MIN_TEAM_CAPACITY}`)
  .max(MAX_TEAM_CAPACITY, `Team size must be at most ${MAX_TEAM_CAPACITY}`);

export const parseOptionsSchema = z.object({
  delimiter: delimiterSchema.optional(),
  teamCapacity: teamCapacitySchema.optional(),
});

export type ParseOptions = z.infer<typeof parseOptionsSchema>;

export const teamNameSchema = z
  .string()
  .trim()
  .min(1, "Team name is required")
  .max(MAX_TEAM_NAME_LENGTH, `Team name must be at most ${MAX_TEAM_NAME_LENGTH} characters`);

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, "Player name is required")
  .max(MAX_PLAYER_NAME_LENGTH, `Player name must be at most ${MAX_PLAYER_NAME_LENGTH} characters`);
