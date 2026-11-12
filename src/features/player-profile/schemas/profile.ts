import { z } from "zod";

// Authoritative: 03 §1 + 05 §1.
// display_name: 1-40 chars; bio: optional, trimmed, <=280.
// App-level link/HTML policy (07/08) is enforced at the action layer, not by
// DB CHECK; the schema rejects angle brackets as a boundary guard only.

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "display name must not be empty")
  .max(40, "display name must be 40 chars or fewer")
  .refine((v) => !/[<>]/.test(v), "display name must not contain markup");

export const bioSchema = z
  .string()
  .trim()
  .max(280, "bio must be 280 chars or fewer")
  .refine((v) => !/[<>]/.test(v), "bio must not contain markup")
  .optional();
