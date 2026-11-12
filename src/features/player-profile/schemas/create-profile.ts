import { z } from "zod";
import { countryCodeInputSchema } from "./country-code";
import { handleSchema } from "./handle";
import { bioSchema, displayNameSchema } from "./profile";

// Authoritative: 07 createPlayerProfile + 08 T4 (mass assignment).
// Creation forces undiscoverable (DB default false + dedicated
// setDiscoverability action). This input therefore accepts NO
// is_discoverable, user_id, status or administrative flags; .strict()
// rejects them so a crafted client field can never slip through.

export const createPlayerProfileInputSchema = z
  .object({
    handle: handleSchema,
    display_name: displayNameSchema,
    bio: bioSchema,
    country_code: countryCodeInputSchema,
  })
  .strict();

export type CreatePlayerProfileInput = z.infer<
  typeof createPlayerProfileInputSchema
>;
