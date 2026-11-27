// P6 roster & slot builder — Zod input boundaries (form-friendly raw strings).
// All user text enters as strings and is validated here before the pure
// domain module touches it. Lengths and counts are hard upper bounds so no
// control can inject oversized data; the engine re-validates defensively and
// throws RosterError (never NaN, never silent truncation).
//
// Game-awareness lives at this boundary: only "bgmi" is accepted today.
// Planned titles ("mlbb") and unknown keys are rejected with distinct errors
// so callers can explain *why* instead of silently applying BGMI rules.

import { z } from "zod";
import { isPlannedGameKey, isSupportedGameKey } from "@/lib/game-catalog/catalog";

export const SUPPORTED_ROSTER_GAME_KEYS = ["bgmi"] as const;

export type RosterGameKey = (typeof SUPPORTED_ROSTER_GAME_KEYS)[number];

export function isSupportedRosterGameKey(value: unknown): value is RosterGameKey {
  return value === "bgmi";
}

// BGMI role vocabulary — a local frozen copy of the G1 player-profile roles
// (IGL/Assaulter/Support/Scout). Duplicated deliberately: tools never import
// feature/player-profile internals (P5 feature isolation), so the tool keeps
// its own adapter. `null` (Flexible) means "no fixed role", matching the G1
// posture that role is optional. Adding a game adds its vocabulary here plus
// a dispatcher — never by reinterpreting this list as universal.
export const ROSTER_BGMI_ROLES = ["IGL", "Assaulter", "Support", "Scout"] as const;

export type RosterBgmiRole = (typeof ROSTER_BGMI_ROLES)[number];

export function isRosterBgmiRole(value: unknown): value is RosterBgmiRole {
  return (
    typeof value === "string" &&
    (ROSTER_BGMI_ROLES as ReadonlyArray<string>).includes(value)
  );
}

export const MAX_TEAM_NAME_LENGTH = 40;
export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 24;
export const MIN_PLAYER_ID_LENGTH = 4;
export const MAX_PLAYER_ID_LENGTH = 32;
export const MAX_NOTES_LENGTH = 140;
export const MAX_PLAYERS = 12;
export const MIN_STARTER_SLOTS = 1;
export const MAX_STARTER_SLOTS = 6;
export const MIN_SUBSTITUTE_SLOTS = 0;
export const MAX_SUBSTITUTE_SLOTS = 6;

export const SLOT_KINDS = ["starter", "substitute"] as const;

export type SlotKind = (typeof SLOT_KINDS)[number];

export function isSlotKind(value: unknown): value is SlotKind {
  return value === "starter" || value === "substitute";
}

/** Resolve a caller-supplied game key or report exactly why it is rejected. */
export function resolveRosterGameKey(
  input: string,
): { ok: true; gameKey: RosterGameKey } | { ok: false; reason: "planned" | "unsupported" } {
  const normalized = input.trim().toLowerCase();
  if (isSupportedRosterGameKey(normalized)) {
    return { ok: true, gameKey: normalized };
  }
  if (isPlannedGameKey(normalized)) {
    return { ok: false, reason: "planned" };
  }
  if (isSupportedGameKey(normalized)) {
    // A supported platform title the roster tool has no adapter for yet.
    return { ok: false, reason: "unsupported" };
  }
  return { ok: false, reason: "unsupported" };
}

export const rosterGameKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine((value): value is RosterGameKey => isSupportedRosterGameKey(value), {
    message: "Roster Builder supports BGMI only",
  });

export const rosterConfigFormSchema = z
  .object({
    teamName: z.string().trim().max(MAX_TEAM_NAME_LENGTH).optional().default(""),
    gameKey: rosterGameKeySchema,
    starterSlots: z.coerce.number().int().min(MIN_STARTER_SLOTS).max(MAX_STARTER_SLOTS),
    substituteSlots: z.coerce
      .number()
      .int()
      .min(MIN_SUBSTITUTE_SLOTS)
      .max(MAX_SUBSTITUTE_SLOTS),
  })
  .strict();

export type RosterConfigFormInput = z.infer<typeof rosterConfigFormSchema>;

export const rosterRoleSchema = z
  .string()
  .trim()
  .max(16)
  .refine((value) => value === "" || value === "Flexible" || isRosterBgmiRole(value), {
    message: "Role must be Flexible, IGL, Assaulter, Support or Scout",
  });

export const rosterPlayerFormSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(MIN_DISPLAY_NAME_LENGTH, "Display name must be 2–24 characters")
      .max(MAX_DISPLAY_NAME_LENGTH, "Display name must be 2–24 characters"),
    playerId: z.string().trim().max(MAX_PLAYER_ID_LENGTH).optional().default(""),
    role: rosterRoleSchema.optional().default("Flexible"),
    notes: z.string().trim().max(MAX_NOTES_LENGTH, "Notes may be at most 140 characters").optional().default(""),
  })
  .strict()
  .superRefine((form, ctx) => {
    if (form.playerId !== "" && form.playerId.length < MIN_PLAYER_ID_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["playerId"],
        message: "Player ID must be 4–32 characters when provided",
      });
    }
  });

export type RosterPlayerFormInput = z.infer<typeof rosterPlayerFormSchema>;

export const rosterSlotTargetSchema = z
  .object({
    kind: z.enum(SLOT_KINDS),
    index: z.coerce.number().int().min(0).max(Math.max(MAX_STARTER_SLOTS, MAX_SUBSTITUTE_SLOTS) - 1),
  })
  .strict();

export type RosterSlotTargetInput = z.infer<typeof rosterSlotTargetSchema>;
