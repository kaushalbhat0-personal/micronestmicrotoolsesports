import { z } from "zod";

// Authoritative: 03 §1 + 05 §1 + APPROVED D-G1-09 (11 §3).
// country_code is an OPTIONAL ISO 3166-1 alpha-2 code. ONLINE is never valid
// here (it belongs to game-region vocabularies, not countries).
// The full country allowlist is frozen at the G1-2 migration; this boundary
// enforces format only and must not invent the seed list.

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "country_code must be ISO 3166-1 alpha-2")
  .refine((v) => v !== "ONLINE", "ONLINE is never a country_code");

export const countryCodeInputSchema = countryCodeSchema.optional();

export type CountryCode = z.infer<typeof countryCodeSchema>;
