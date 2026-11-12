// P3 tournaments — Zod boundaries (new vertical, no legacy port).
// Layers:
// - Directory input: shape-only filters for the proposed RPC pair.
// - Eligibility: game-agnostic structured requirements + free note.
// - Publishing draft: strict creation/editing contract (writes disabled).
// Per-game validation (BGMI region vocabulary) is enforced at the reader
// layer for known games, mirroring the P1 teams posture.

import { z } from "zod";
import { gameKeySchema } from "@/features/player-profile/schemas/game";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { LIFECYCLE_STATES, PARTICIPATION_FORMATS } from "../domain/tournament";
import { ORGANIZER_KINDS } from "../domain/organizer";
import {
  MAX_CONTACT_LENGTH,
  MAX_REGISTRATION_URL_LENGTH,
} from "../domain/registration";
import { MAX_MONEY_MINOR } from "../domain/money";

export const MAX_TOURNAMENT_TITLE_LENGTH = 120;
export const MAX_TOURNAMENT_DESCRIPTION_LENGTH = 4000;
export const MAX_ELIGIBILITY_NOTE_LENGTH = 500;
export const MAX_ORGANIZER_NAME_LENGTH = 80;

export const tournamentSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
  .min(2)
  .max(80);

const moneySchema = z.object({
  amountMinor: z.number().int().min(0).max(MAX_MONEY_MINOR),
  currency: z.string().regex(/^[A-Z]{3}$/, "currency must be a 3-letter ISO code"),
});

export type MoneyInput = z.infer<typeof moneySchema>;

const organizerSchema = z.object({
  kind: z.enum(ORGANIZER_KINDS),
  name: z.string().trim().min(2, "Organizer name is required").max(MAX_ORGANIZER_NAME_LENGTH),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(2)
    .max(80)
    .nullish(),
  verified: z.literal(false),
});

export type OrganizerInput = z.infer<typeof organizerSchema>;

const registrationSchema = z.object({
  method: z.literal("external"),
  url: z
    .string()
    .trim()
    .min(1, "Registration URL is required")
    .max(MAX_REGISTRATION_URL_LENGTH)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return (
          parsed.protocol === "https:" &&
          parsed.username === "" &&
          parsed.password === "" &&
          parsed.hostname !== ""
        );
      } catch {
        return false;
      }
    }, "Registration URL must be a valid https URL without credentials"),
  contactInstructions: z.string().trim().max(MAX_CONTACT_LENGTH).optional(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const eligibilitySchema = z
  .object({
    minTeamSize: z.number().int().min(1).max(10).optional(),
    maxTeamSize: z.number().int().min(1).max(10).optional(),
    regionCodes: z.array(z.enum(BGMI_REGION_VOCABULARY)).max(7).optional(),
    minAge: z.number().int().min(10).max(100).optional(),
    note: z.string().trim().max(MAX_ELIGIBILITY_NOTE_LENGTH).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.minTeamSize === undefined ||
      value.maxTeamSize === undefined ||
      value.minTeamSize <= value.maxTeamSize,
    "Minimum team size cannot exceed maximum team size",
  );

export type EligibilityInput = z.infer<typeof eligibilitySchema>;

// Publishing draft (strict): protected keys (ids, owner identity, lifecycle
// internals, verification) are rejected, never silently dropped. Writes stay
// disabled — see server/tournament-writer gate + P3 docs.
//
// Structure note (Zod v4): .omit() cannot follow .refine(), so the draft
// base is declared once without refinements; the draft and update schemas
// each apply the shared date-ordering refinement after their own shape.
const tournamentDraftBase = z.object({
    slug: tournamentSlugSchema,
    title: z.string().trim().min(2, "Tournament title is required").max(MAX_TOURNAMENT_TITLE_LENGTH),
    description: z.string().trim().max(MAX_TOURNAMENT_DESCRIPTION_LENGTH).optional(),
    gameKey: z.literal("bgmi"),
    regionCode: z.enum(BGMI_REGION_VOCABULARY),
    format: z.enum(PARTICIPATION_FORMATS),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timezone: z.string().min(1).max(64),
    entryFee: moneySchema.nullish(),
    prizePool: moneySchema.nullish(),
    organizer: organizerSchema,
    registration: registrationSchema,
    eligibility: eligibilitySchema.optional(),
    registrationClosesAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

function dateOrderRefinement<T extends { startsAt: string; endsAt: string }>(value: T): boolean {
  return Date.parse(value.endsAt) > Date.parse(value.startsAt);
}

const ENDS_AFTER_STARTS = {
  message: "Tournament must end after it starts",
  path: ["endsAt"] as string[],
};

export const tournamentDraftSchema = tournamentDraftBase.refine(dateOrderRefinement, {
  ...ENDS_AFTER_STARTS,
});

export type TournamentDraftInput = z.infer<typeof tournamentDraftSchema>;

export const tournamentUpdateSchema = tournamentDraftBase
  .omit({ slug: true, gameKey: true })
  .refine(dateOrderRefinement, {
    ...ENDS_AFTER_STARTS,
  });

export type TournamentUpdateInput = z.infer<typeof tournamentUpdateSchema>;

export const unpublishSchema = z
  .object({
    slug: tournamentSlugSchema,
    reason: z.string().trim().min(10).max(MAX_ELIGIBILITY_NOTE_LENGTH).optional(),
  })
  .strict();

export type UnpublishInput = z.infer<typeof unpublishSchema>;

// Directory input for the PROPOSED RPC pair (shape-only; per-game
// vocabulary enforced at the reader for known games).
export const searchTournamentsInputSchema = z
  .object({
    game: gameKeySchema.optional(),
    region: z.string().trim().min(1).max(48).optional(),
    status: z.enum(["upcoming", "ongoing", "completed"]).optional(),
    query: z.string().trim().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(60).default(24),
    offset: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

export type SearchTournamentsInput = z.infer<typeof searchTournamentsInputSchema>;

export const getTournamentBySlugInputSchema = z.object({
  slug: tournamentSlugSchema,
});

export type GetTournamentBySlugInput = z.infer<typeof getTournamentBySlugInputSchema>;

export const LIFECYCLE_STATE_VALUES = LIFECYCLE_STATES;
