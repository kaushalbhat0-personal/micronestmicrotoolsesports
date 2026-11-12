import { z } from "zod";

// Authoritative: 03 §1 (is_discoverable DEFAULT false) + 04 §2 + 07
// setDiscoverability. Creation forces undiscoverable; publishing is a separate
// explicit action. A client-provided value is never sufficient authorization —
// RLS + the dedicated server action enforce that (G1-7).

export const discoverabilitySchema = z.boolean();

export const setDiscoverabilityInputSchema = z
  .object({ is_discoverable: discoverabilitySchema })
  .strict();

export type SetDiscoverabilityInput = z.infer<
  typeof setDiscoverabilityInputSchema
>;
