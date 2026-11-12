/**
 * Prize Splitter — Schemas
 * Zod schemas were previously duplicated with imperative validation.
 * Canonical validation is now `validateInput` in services/calculation.ts.
 * This file retains only the currency enum for external consumers that need it;
 * no duplicated splitInputSchema is maintained to avoid drift.
 */
import { z } from "zod";

export const currencySchema = z.enum(["INR", "USD", "EUR", "GBP"]);
// splitInputSchema removed — use validateInput from services/calculation as single source of truth.
export type CurrencySchema = z.infer<typeof currencySchema>;
