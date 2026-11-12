// D1 teams — zod boundaries (REIMPLEMENT from legacy finder schemas, G1-aligned).
// Legacy: legacy/application/src/features/finder/schemas/finder.ts
// D1 decisions (see 04-finder-domain-contracts.md):
// - No character_id / game_user_id (D-G1-04 Option A: omitted in all forms).
// - Region uses BGMI vocabulary codes (G1), not free text.
// - One team supports one game in D1 (game_key FK to games).
// - Captain roles: captain | co-captain | player | sub.
import { z } from "zod";
import { COMPETITIVE_LEVELS } from "../domain/levels";
import { BGMI_ROLES } from "../domain/roles";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";

export const MAX_BIO_LENGTH = 280;
export const MAX_NOTE_LENGTH = 200;
export const MAX_TEAM_DESCRIPTION_LENGTH = 1000;
export const MAX_REPORT_REASON_LENGTH = 1000;
export const MIN_REPORT_REASON_LENGTH = 10;

const levelSchema = z.enum(COMPETITIVE_LEVELS);

export const teamSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase words joined by hyphens")
  .min(2)
  .max(60);

export const teamSchema = z.object({
  slug: teamSlugSchema,
  name: z.string().trim().min(2, "Team name is required").max(60),
  gameKey: z.literal("bgmi"),
  regionCode: z.enum(BGMI_REGION_VOCABULARY),
  currentLevel: levelSchema,
  targetLevel: levelSchema,
  description: z.string().max(MAX_TEAM_DESCRIPTION_LENGTH).optional(),
  recruiting: z.boolean().default(true),
  isPublic: z.boolean().default(true),
});

export type TeamInput = z.infer<typeof teamSchema>;

export const teamUpdateSchema = teamSchema.omit({ slug: true, gameKey: true });

export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>;

export const memberRoleSchema = z.enum(["captain", "co-captain", "player", "sub"]);

export type MemberRole = z.infer<typeof memberRoleSchema>;

export const recruitmentPostSchema = z.object({
  roleNeeded: z.enum(BGMI_ROLES),
  slots: z.number().int().min(1).max(10),
  currentLevelMin: levelSchema,
  targetLevel: levelSchema,
  regionCode: z.enum(BGMI_REGION_VOCABULARY),
  tryoutRequired: z.boolean().default(true),
  status: z.enum(["open", "paused", "closed", "filled"]).default("open"),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export type RecruitmentPostInput = z.infer<typeof recruitmentPostSchema>;

export const applicationNoteSchema = z.string().max(MAX_NOTE_LENGTH).optional();

export const applicationSchema = z.object({ note: applicationNoteSchema });

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const applicationDecisionSchema = z.enum(["shortlisted", "accepted", "declined"]);

export type ApplicationDecision = z.infer<typeof applicationDecisionSchema>;

export const reportSchema = z.object({
  targetType: z.enum(["player", "team", "recruitment_post", "application"]),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(MIN_REPORT_REASON_LENGTH).max(MAX_REPORT_REASON_LENGTH),
});

export type ReportInput = z.infer<typeof reportSchema>;
