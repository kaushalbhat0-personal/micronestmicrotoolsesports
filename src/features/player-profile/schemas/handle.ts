import { z } from "zod";

// Authoritative: 03 §1/§7 + 05 §1 (CHECK handle ~ '^[a-z0-9_]{3,20}$',
// stored lowercase, UNIQUE lower(handle)) + 07 HandleInput.
// D-G1-05 (throttle/availability checking) is OPEN — no rate limit here.

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "handle must be 3-20 chars: a-z, 0-9, _");

export const handleInputSchema = z
  .object({ handle: handleSchema })
  .strict();

export type HandleInput = z.infer<typeof handleInputSchema>;
