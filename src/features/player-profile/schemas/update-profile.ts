import { z } from "zod";
import { avatarPathSchema } from "./avatar";
import { countryCodeSchema } from "./country-code";
import { bioSchema, displayNameSchema } from "./profile";

// Authoritative: 07 updatePlayerProfile + 08 T4 (mass assignment).
// Owner-only generic patch. Explicit allowlist ONLY:
//   display_name, bio, country_code, avatar_path.
// Rejected by .strict() (never silently ignored):
//   handle (separate throttled flow, D-G1-05 open, G1-7 owns it),
//   is_discoverable (dedicated consent action, G1-7 owns it),
//   user_id / status / administrative flags (never client-writable).
// Nullable optionals allow clearing (bio/country/avatar are NULL-able
// columns); display_name is NOT NULL so it accepts no null.

export const updatePlayerProfileInputSchema = z
  .object({
    display_name: displayNameSchema.optional(),
    bio: bioSchema.nullable().optional(),
    country_code: countryCodeSchema.nullable().optional(),
    avatar_path: avatarPathSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "no fields to update");

export type UpdatePlayerProfileInput = z.infer<
  typeof updatePlayerProfileInputSchema
>;
