import { z } from "zod";
import { COMPETITIVE_LEVELS } from "../domain/levels";
import { BGMI_ROLES } from "../domain/roles";

/**
 * Finder — validation single source.
 *
 * Boundary schemas for the future UI/workflow layer. Mirror the
 * 20251121000001_finder_foundation.sql CHECK constraints so invalid rows
 * fail fast in the application before reaching the database.
 */

export const MAX_BIO_LENGTH = 280;
export const MAX_NOTE_LENGTH = 200;
export const MAX_TEAM_DESCRIPTION_LENGTH = 1000;
export const MAX_REPORT_REASON_LENGTH = 1000;
export const MIN_REPORT_REASON_LENGTH = 10;

const levelSchema = z.enum(COMPETITIVE_LEVELS, {
  invalid_type_error: "Level must be a valid competitive context",
});

export const handleSchema = z
  .string({ invalid_type_error: "Handle must be text" })
  .trim()
  .toLowerCase()
  .min(3, "Handle must be at least 3 characters")
  .max(20, "Handle must be at most 20 characters")
  .regex(/^[a-z0-9_]+$/, "Handle may contain only lowercase letters, numbers, and underscores");

/** BGMI Character ID: numeric TEXT, leading zeroes preserved. Never coerce. */
export const characterIdSchema = z
  .string({ invalid_type_error: "Character ID must be text" })
  .trim()
  .regex(/^[0-9]{4,12}$/, "Character ID must be 4–12 digits");

export const ignSchema = z
  .string({ invalid_type_error: "IGN must be text" })
  .trim()
  .min(2, "IGN must be at least 2 characters")
  .max(30, "IGN must be at most 30 characters");

export const bioSchema = z
  .string()
  .max(MAX_BIO_LENGTH, `Bio must be at most ${MAX_BIO_LENGTH} characters`)
  .optional();

export const applicationNoteSchema = z
  .string()
  .max(MAX_NOTE_LENGTH, `Note must be at most ${MAX_NOTE_LENGTH} characters`)
  .optional();

export const finderProfileSchema = z.object({
  handle: handleSchema,
  display_name: z.string().trim().min(1, "Display name is required").max(40),
  region: z.string().trim().min(1, "Region is required").max(40),
  current_level: levelSchema,
  target_level: levelSchema,
  primary_role: z.enum(BGMI_ROLES, { invalid_type_error: "Role must be a valid BGMI role" }),
  bio: bioSchema,
  looking_for: z.boolean().default(true),
  open_to_tryout: z.boolean().default(false),
  allow_indexing: z.boolean().default(false),
});

export type FinderProfileInput = z.infer<typeof finderProfileSchema>;

export const gameProfileSchema = z.object({
  game: z.literal("bgmi"),
  ign: ignSchema,
  character_id: characterIdSchema,
});

export type GameProfileInput = z.infer<typeof gameProfileSchema>;

export const teamSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
    .min(2)
    .max(60),
  name: z.string().trim().min(2, "Team name is required").max(60),
  region: z.string().trim().min(1, "Region is required").max(40),
  current_level: levelSchema,
  target_level: levelSchema,
  description: z
    .string()
    .max(MAX_TEAM_DESCRIPTION_LENGTH)
    .optional(),
  recruiting: z.boolean().default(true),
});

export type TeamInput = z.infer<typeof teamSchema>;

export const recruitmentPostSchema = z.object({
  role_needed: z.enum(BGMI_ROLES, { invalid_type_error: "Role must be a valid BGMI role" }),
  slots: z
    .number({ invalid_type_error: "Slots must be a number" })
    .int("Slots must be a whole number")
    .min(1, "Slots must be at least 1")
    .max(10, "Slots must be at most 10"),
  current_level_min: levelSchema,
  target_level: levelSchema,
  region: z.string().trim().min(1, "Region is required").max(40),
  tryout_required: z.boolean().default(true),
  status: z.enum(["open", "paused", "closed", "filled"]).default("open"),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

export type RecruitmentPostInput = z.infer<typeof recruitmentPostSchema>;

export const applicationSchema = z.object({
  note: applicationNoteSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const reportSchema = z.object({
  target_type: z.enum(["player", "team", "recruitment_post", "application"]),
  target_id: z.string().uuid("Target must be a valid id"),
  reason: z
    .string()
    .trim()
    .min(MIN_REPORT_REASON_LENGTH, "Please describe the issue in more detail")
    .max(MAX_REPORT_REASON_LENGTH),
});

export type ReportInput = z.infer<typeof reportSchema>;

// ─────────────────────────────────────────────────────────────
// Phase B — authenticated profile form (extends the Phase A base).
// New fields only; existing schemas above are untouched.
// ─────────────────────────────────────────────────────────────

export const MAX_LANGUAGES = 5;
export const MAX_AVAILABILITY_SLOTS = 7;

export const profileLanguagesSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(MAX_LANGUAGES, `Choose at most ${MAX_LANGUAGES} languages`)
  .default([]);

export const availabilitySchema = z
  .array(z.string().trim().min(1).max(40))
  .max(MAX_AVAILABILITY_SLOTS, `Choose at most ${MAX_AVAILABILITY_SLOTS} availability windows`)
  .default([]);

export const secondaryRolesSchema = z
  .array(z.enum(BGMI_ROLES, { invalid_type_error: "Role must be a valid BGMI role" }))
  .max(3, "Choose at most 3 secondary roles")
  .default([]);

export const timezoneSchema = z
  .string()
  .trim()
  .max(60, "Timezone must be at most 60 characters")
  .optional();

export const myProfileFormSchema = finderProfileSchema.extend({
  languages: profileLanguagesSchema,
  timezone: timezoneSchema,
  secondary_roles: secondaryRolesSchema,
  availability: availabilitySchema,
});

export type MyProfileFormInput = z.infer<typeof myProfileFormSchema>;

export const myProfileSaveSchema = z.object({
  profile: myProfileFormSchema,
  game: gameProfileSchema,
});

export type MyProfileSaveInput = z.infer<typeof myProfileSaveSchema>;

// ─────────────────────────────────────────────────────────────
// Phase C — team + recruitment + application (extends Phase A base).
// New schemas only; existing schemas above are untouched. Every
// constraint mirrors 20251121000001_finder_foundation.sql CHECKs.
// ─────────────────────────────────────────────────────────────

export const MAX_EXPERIENCE_LENGTH = 120;

export const contactModeSchema = z.enum(["application_only", "external_link"]);

export const externalLinkSchema = z
  .string()
  .trim()
  .max(208, "External link must be at most 208 characters")
  .regex(/^https:\/\/[^ ]{1,200}$/, "External link must be an https:// URL without spaces")
  .optional();

export const teamRoleSchema = z.enum(["captain", "co-captain", "player", "sub"]);

export const teamCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
    .min(2)
    .max(60),
  name: z.string().trim().min(2, "Team name is required").max(60),
  game: z.literal("bgmi").default("bgmi"),
  region: z.string().trim().min(1, "Region is required").max(40),
  description: z.string().max(MAX_TEAM_DESCRIPTION_LENGTH).optional(),
  current_level: levelSchema,
  target_level: levelSchema,
  recruiting: z.boolean().default(true),
  contact_mode: contactModeSchema.default("application_only"),
  external_link: externalLinkSchema,
  is_public: z.boolean().default(true),
});

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;

export const teamUpdateSchema = z.object({
  name: z.string().trim().min(2, "Team name is required").max(60),
  region: z.string().trim().min(1, "Region is required").max(40),
  description: z.string().max(MAX_TEAM_DESCRIPTION_LENGTH).optional(),
  current_level: levelSchema,
  target_level: levelSchema,
  recruiting: z.boolean(),
  contact_mode: contactModeSchema,
  external_link: externalLinkSchema,
  is_public: z.boolean(),
});

export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;

export const recruitmentPostCreateSchema = z.object({
  team_id: z.string().uuid("Team must be a valid id"),
  game: z.literal("bgmi").default("bgmi"),
  role_needed: z.enum(BGMI_ROLES, { invalid_type_error: "Role must be a valid BGMI role" }),
  slots: z
    .number({ invalid_type_error: "Slots must be a number" })
    .int("Slots must be a whole number")
    .min(1, "Slots must be at least 1")
    .max(10, "Slots must be at most 10"),
  current_level_min: levelSchema,
  target_level: levelSchema,
  region: z.string().trim().min(1, "Region is required").max(40),
  availability_required: availabilitySchema,
  experience_min: z.string().trim().max(MAX_EXPERIENCE_LENGTH).optional(),
  tryout_required: z.boolean().default(true),
  status: z.enum(["open", "paused", "closed", "filled"]).default("open"),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

export type RecruitmentPostCreateInput = z.infer<typeof recruitmentPostCreateSchema>;

export const recruitmentPostUpdateSchema = z.object({
  role_needed: z.enum(BGMI_ROLES, { invalid_type_error: "Role must be a valid BGMI role" }),
  slots: z
    .number({ invalid_type_error: "Slots must be a number" })
    .int("Slots must be a whole number")
    .min(1, "Slots must be at least 1")
    .max(10, "Slots must be at most 10"),
  current_level_min: levelSchema,
  target_level: levelSchema,
  region: z.string().trim().min(1, "Region is required").max(40),
  availability_required: availabilitySchema,
  experience_min: z.string().trim().max(MAX_EXPERIENCE_LENGTH).optional(),
  tryout_required: z.boolean(),
  status: z.enum(["open", "paused", "closed", "filled"]),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

export type RecruitmentPostUpdateInput = z.infer<typeof recruitmentPostUpdateSchema>;

export const applicationCreateSchema = z.object({
  post_id: z.string().uuid("Post must be a valid id"),
  note: applicationNoteSchema,
});

export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;

export const applicationDecideSchema = z.object({
  status: z.enum(["shortlisted", "accepted", "declined"]),
});

export type ApplicationDecideInput = z.infer<typeof applicationDecideSchema>;

export const memberRoleUpdateSchema = z.object({
  role: teamRoleSchema,
  game_role: z
    .enum(BGMI_ROLES, { invalid_type_error: "Role must be a valid BGMI role" })
    .optional(),
});

export type MemberRoleUpdateInput = z.infer<typeof memberRoleUpdateSchema>;
