import { z } from "zod";

/**
 * Draft & Ban — Zod schemas (single source for validation).
 * Used by services/actions for match + template input. Engine re-checks
 * normalized values so server never trusts client state.
 */

export const TEAM_NAME_MAX = 40;
export const POOL_ITEM_MAX = 60;
export const POOL_MIN = 2;
export const POOL_MAX = 100;
export const SEQUENCE_MAX = 100;
export const TEMPLATE_NAME_MAX = 60;
export const METADATA_SHORT_MAX = 80;
export const FORMAT_LABEL_MAX = 20;
export const NOTES_MAX = 500;
export const TEMPLATES_PER_ORG_MAX = 20;

const teamNameSchema = z.string().trim().min(1, "Team name is required").max(TEAM_NAME_MAX, `Team name must be at most ${TEAM_NAME_MAX} characters`);

const poolItemSchema = z.string().trim().min(1, "Pool item is required").max(POOL_ITEM_MAX, `Pool item must be at most ${POOL_ITEM_MAX} characters`);

export const draftStepSchema = z.object({
  team: z.enum(["A", "B"]),
  type: z.enum(["ban", "pick"]),
});

export const draftConfigSchema = z
  .object({
    teamA: teamNameSchema,
    teamB: teamNameSchema,
    pool: z.array(poolItemSchema).min(POOL_MIN, `Add at least ${POOL_MIN} pool items`).max(POOL_MAX, `Pool supports at most ${POOL_MAX} items`),
    sequence: z.array(draftStepSchema).min(1, "Sequence must contain at least one step").max(SEQUENCE_MAX, `Sequence supports at most ${SEQUENCE_MAX} steps`),
  })
  .superRefine((val, ctx) => {
    if (val.teamA.trim().toLowerCase() === val.teamB.trim().toLowerCase()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["teamB"], message: "Team names must be different" });
    }
    const seen = new Map<string, number>();
    val.pool.forEach((item) => {
      const key = item.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    const dupes = [...seen.entries()].filter(([, n]) => n > 1);
    if (dupes.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pool"], message: "Pool items must be unique (case-insensitive)" });
    }
    const required = val.sequence.length;
    if (val.pool.length < required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pool"],
        message: `Pool needs at least ${required} items for this sequence (${val.pool.length} provided)`,
      });
    }
  });

export const templateConfigSchema = z.object({
  sequence: z.array(draftStepSchema).min(1).max(SEQUENCE_MAX),
  pool: z.array(poolItemSchema).max(POOL_MAX),
  teamA: z.string().trim().max(TEAM_NAME_MAX).nullable().default(null),
  teamB: z.string().trim().max(TEAM_NAME_MAX).nullable().default(null),
});

export const templateNameSchema = z.string().trim().min(1, "Template name is required").max(TEMPLATE_NAME_MAX);

export const matchMetadataSchema = z.object({
  matchName: z.string().trim().max(METADATA_SHORT_MAX).nullable().default(null),
  eventName: z.string().trim().max(METADATA_SHORT_MAX).nullable().default(null),
  formatLabel: z.string().trim().max(FORMAT_LABEL_MAX).nullable().default(null),
  notes: z.string().trim().max(NOTES_MAX).nullable().default(null),
});

export const createMatchInputSchema = z.object({
  teamA: teamNameSchema,
  teamB: teamNameSchema,
  pool: z.array(poolItemSchema).min(POOL_MIN).max(POOL_MAX),
  sequence: z.array(draftStepSchema).min(1).max(SEQUENCE_MAX),
  templateId: z.string().uuid().nullable().default(null),
  matchName: z.string().trim().max(METADATA_SHORT_MAX).nullable().default(null),
  eventName: z.string().trim().max(METADATA_SHORT_MAX).nullable().default(null),
  formatLabel: z.string().trim().max(FORMAT_LABEL_MAX).nullable().default(null),
  notes: z.string().trim().max(NOTES_MAX).nullable().default(null),
});

export const applyActionInputSchema = z.object({
  matchId: z.string().uuid(),
  team: z.enum(["A", "B"]),
  item: poolItemSchema,
  expectedActionCount: z.number().int().min(0),
});
