import { z } from "zod";

// Authoritative: 03 §2/§3 + 05 §1 + 07 GameProfileInput + APPROVED D-G1-09.
// game_key: text PK, ^[a-z0-9-]{2,24}$ (05 §1). BGMI seed: 'bgmi'.
// region_code is GAME-SPECIFIC and selected by game_key. The BGMI vocabulary
// below is BGMI-only and must never be treated as universal.

export const gameKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,24}$/, "game_key must be 2-24 chars: a-z, 0-9, -");

// BGMI vocabulary (05 §1, illustrative frozen set).
export const BGMI_REGION_VOCABULARY = [
  "india",
  "asia",
  "europe",
  "north-america",
  "south-america",
  "middle-east",
  "online",
] as const;

export type BgmiRegion = (typeof BGMI_REGION_VOCABULARY)[number];

export function makeGameRegionSchema<const T extends string>(
  allowed: readonly T[],
) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v): v is T => (allowed as readonly string[]).includes(v),
      "region not in this game's vocabulary",
    );
}

export const bgmiRegionSchema = makeGameRegionSchema(BGMI_REGION_VOCABULARY);

// Per-game region dispatcher. Only 'bgmi' is approved in G1; unknown games
// are rejected here so a caller can never silently apply the BGMI vocabulary
// to another title. Adding a game adds a catalogue row + its vocabulary.
const GAME_REGION_SCHEMAS = {
  bgmi: bgmiRegionSchema,
} as const;

export type KnownGameKey = keyof typeof GAME_REGION_SCHEMAS;

export function validateGameRegion(gameKey: string, region: string): boolean {
  const key = gameKey.trim().toLowerCase();
  const schema =
    GAME_REGION_SCHEMAS[key as KnownGameKey] as unknown as
      | ReturnType<typeof makeGameRegionSchema<string>>
      | undefined;
  if (!schema) return false;
  return schema.safeParse(region).success;
}

// BGMI roles (03 §3/§5 + 05 §1). NULL = flexible (handled at the action layer
// via .optional(), not here).
export const BGMI_ROLES = ["IGL", "Assaulter", "Support", "Scout"] as const;

export const bgmiPrimaryRoleSchema = z.enum(BGMI_ROLES);

// BGMI play modes (05 §1): subset of the frozen set, max 5.
export const BGMI_PLAY_MODES = ["squad", "duo", "solo", "tpp", "fpp"] as const;

export const bgmiPlayModesSchema = z.array(z.enum(BGMI_PLAY_MODES)).max(5);

// Availability windows are catalogued sets (03 §3, max 7). The exact window
// vocabulary is frozen at the G1-3 migration; this boundary enforces shape
// only (non-empty tokens, max 7) and must not invent the enum.
export const availabilitySchema = z
  .array(z.string().trim().min(1).max(48))
  .max(7);

// IGN: trimmed 2-30 (03 §3 + 05 §1). Self-declared.
export const ignSchema = z
  .string()
  .trim()
  .min(2, "ign must be 2-30 chars")
  .max(30, "ign must be 2-30 chars");

// game_user_id: optional title identifier kept as text (leading zeroes
// preserved), 4-32 per 05 §1 CHECK. Owner-private; omitted from all public
// projections in every form per APPROVED D-G1-03 + D-G1-04 Option A
// (2026-11-11): never searched, filtered or deduplicated in G1.
export const gameUserIdSchema = z
  .string()
  .trim()
  .min(4, "game user id must be 4-32 chars")
  .max(32, "game user id must be 4-32 chars")
  .optional();
