import { z } from "zod";
import { gameKeySchema } from "./game";
import { handleInputSchema } from "./handle";

// Authoritative: 05 §5 + 07 DirectorySearchInput + 11 §3 (APPROVED D-G1-03).
// limit 1..48 is frozen. offset is non-negative here; the explicit server
// maximum is enforced SQL-side at G1-4 (LEAST/GREATEST) and not invented here.
// query max 120 is a scaffold-local DoS guard; the authoritative bound is
// frozen with the G1-4 functions. region/role are allowlisted per game at the
// action layer (D-G1-09); this boundary enforces shape only.

export const searchDirectoryInputSchema = z
  .object({
    game: gameKeySchema.optional(),
    region: z.string().trim().min(1).max(48).optional(),
    role: z.string().trim().min(1).max(32).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(48).default(24),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export type SearchDirectoryInput = z.infer<typeof searchDirectoryInputSchema>;

export const getPlayerByHandleInputSchema = handleInputSchema;

export type GetPlayerByHandleInput = z.infer<
  typeof getPlayerByHandleInputSchema
>;
