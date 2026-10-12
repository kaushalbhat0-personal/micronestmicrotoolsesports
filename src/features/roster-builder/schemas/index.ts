import { z } from "zod";
import {
  MAX_INPUT_CHARS,
  MAX_TEAM_CAPACITY,
  MAX_TEAM_NAME_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  MIN_TEAM_CAPACITY,
} from "../types";

/**
 * Tournament Roster & Slot Builder — validation single source.
 *
 * Boundary schemas for the future UI/workflow layer. The pure parser also
 * enforces the same limits structurally so oversized input maps to stable
 * `oversized-input` errors instead of generic validation failures.
 */

export const delimiterSchema = z.enum(["\t", ",", ";", "|"], {
  invalid_type_error: "Delimiter must be one of tab, comma, semicolon, or pipe",
});

export const pastedInputSchema = z
  .string({ invalid_type_error: "Pasted registrations must be text" })
  .min(1, "Paste at least one registration line to clean a roster")
  .max(MAX_INPUT_CHARS, `Pasted input is too large (maximum ${MAX_INPUT_CHARS.toLocaleString("en-IN")} characters)`);

export const teamCapacitySchema = z
  .number({ invalid_type_error: "Team size must be a number" })
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
