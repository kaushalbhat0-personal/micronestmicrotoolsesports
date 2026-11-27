// P9 organizer + tournament management schemas — strict creation/editing
// contracts (writes disabled). Protected keys (ids, owner identity,
// membership, verification, lifecycle internals, counts) are REJECTED,
// never silently dropped. Money uses integer minor units; registration URLs
// are https-only without credentials; timezones validate via Intl
// construction (ICU-proof); game keys validate via the catalogue schema.

import { z } from "zod";
import { gameKeySchema, BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { ORGANIZER_TYPES } from "../domain/organizer-type";
import { MAX_MONEY_MINOR } from "@/features/tournaments/domain/money";
import {
  MAX_CONTACT_LENGTH,
  MAX_REGISTRATION_URL_LENGTH,
} from "@/features/tournaments/domain/registration";
import { PARTICIPATION_FORMATS } from "@/features/tournaments/domain/tournament";

export const MAX_ORGANIZER_NAME_LENGTH = 80;
export const MAX_ORGANIZER_DESCRIPTION_LENGTH = 1000;
export const MAX_TOURNAMENT_TITLE_LENGTH = 120;
export const MAX_TOURNAMENT_DESCRIPTION_LENGTH = 4000;
export const MAX_ELIGIBILITY_NOTE_LENGTH = 500;

export const organizerSlugSchema = z
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

const socialLinkSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    url: z
      .string()
      .trim()
      .min(1)
      .max(2000)
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
      }, "Social link must be a valid https URL without credentials"),
  })
  .strict();

const httpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
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
  }, "URL must be a valid https URL without credentials");

export const createOrganizerInputSchema = z
  .object({
    slug: organizerSlugSchema,
    name: z.string().trim().min(2).max(MAX_ORGANIZER_NAME_LENGTH),
    description: z.string().trim().max(MAX_ORGANIZER_DESCRIPTION_LENGTH).optional(),
    regionCode: z.enum(BGMI_REGION_VOCABULARY),
    organizerType: z.enum(ORGANIZER_TYPES),
    gameKeys: z.array(gameKeySchema).min(1).max(8),
    websiteUrl: httpsUrlSchema.optional(),
    socialLinks: z.array(socialLinkSchema).max(8).optional(),
  })
  .strict();

export type CreateOrganizerInput = z.infer<typeof createOrganizerInputSchema>;

export const updateOrganizerInputSchema = z
  .object({
    organizerId: z.string().uuid(),
    patch: z
      .object({
        name: z.string().trim().min(2).max(MAX_ORGANIZER_NAME_LENGTH),
        description: z.string().trim().max(MAX_ORGANIZER_DESCRIPTION_LENGTH).optional(),
        regionCode: z.enum(BGMI_REGION_VOCABULARY),
        gameKeys: z.array(gameKeySchema).min(1).max(8),
        websiteUrl: httpsUrlSchema.nullish(),
        socialLinks: z.array(socialLinkSchema).max(8).optional(),
      })
      .strict(),
  })
  .strict();

export type UpdateOrganizerInput = z.infer<typeof updateOrganizerInputSchema>;

const registrationSchema = z
  .object({
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
  })
  .strict();

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
    "Minimum team size cannot exceed maximum team size"
  );

const managedTournamentBase = z
  .object({
    organizerId: z.string().uuid(),
    slug: organizerSlugSchema,
    title: z.string().trim().min(2).max(MAX_TOURNAMENT_TITLE_LENGTH),
    description: z.string().trim().max(MAX_TOURNAMENT_DESCRIPTION_LENGTH).optional(),
    gameKey: z.literal("bgmi"),
    regionCode: z.enum(BGMI_REGION_VOCABULARY),
    format: z.enum(PARTICIPATION_FORMATS),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    timezone: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Timezone must be a valid IANA timezone"),
    entryFee: moneySchema.nullish(),
    prizePool: moneySchema.nullish(),
    registration: registrationSchema,
    eligibility: eligibilitySchema.optional(),
    registrationClosesAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

function dateOrderRefinement<T extends { startsAt: string; endsAt: string }>(value: T): boolean {
  return Date.parse(value.endsAt) > Date.parse(value.startsAt);
}

export const createTournamentInputSchema = managedTournamentBase.refine(dateOrderRefinement, {
  message: "Tournament must end after it starts",
  path: ["endsAt"],
});

export type CreateTournamentInput = z.infer<typeof createTournamentInputSchema>;

export const updateTournamentInputSchema = z
  .object({
    tournamentId: z.string().uuid(),
    patch: managedTournamentBase
      .omit({ organizerId: true, slug: true, gameKey: true })
      .refine(dateOrderRefinement, {
        message: "Tournament must end after it starts",
        path: ["endsAt"],
      }),
  })
  .strict();

export type UpdateTournamentInput = z.infer<typeof updateTournamentInputSchema>;

export const managedTournamentIdSchema = z.string().uuid();
