import { z } from "zod";
import { RULE_IDS } from "../types";

/**
 * Tie-Breaker Resolver — Zod schemas (single source for validation).
 * Services validate with these; the engine defensively re-checks its contract.
 */

export const TEAM_NAME_MAX = 60;
export const TEAM_SHORT_NAME_MAX = 12;
export const COMPETITION_NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;
export const NOTES_MAX = 500;
export const TEAMS_MIN = 2;
export const TEAMS_MAX = 32;
export const RULES_MIN = 2;
export const RULES_MAX = 5;
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

const httpsUrlSchema = z
  .string()
  .url("Logo must be a valid URL")
  .max(500, "Logo URL is too long")
  .refine((u) => u.startsWith("https://"), "Logo URL must use https");

export const ruleIdSchema = z.enum(["points", "h2h", "map_diff", "round_diff", "wins"]);

export const ruleOrderSchema = z
  .array(ruleIdSchema)
  .min(RULES_MIN, `Choose at least ${RULES_MIN} ranking rules`)
  .max(RULES_MAX, `Choose at most ${RULES_MAX} ranking rules`)
  .superRefine((order, ctx) => {
    const seen = new Set<string>();
    for (const rule of order) {
      if (seen.has(rule)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each ranking rule can be used only once" });
        break;
      }
      seen.add(rule);
    }
    if (!order.includes("points")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Points must stay in your ranking rules" });
    }
  });

export const scoringSchema = z.object({
  win: z.number().int("Points must be whole numbers").min(SCORE_MIN).max(SCORE_MAX),
  draw: z.number().int("Points must be whole numbers").min(SCORE_MIN).max(SCORE_MAX),
  loss: z.number().int("Points must be whole numbers").min(SCORE_MIN).max(SCORE_MAX),
  drawsEnabled: z.boolean(),
  roundLabel: z.enum(["rounds", "games"]),
});

export const competitionSchema = z.object({
  name: z.string().trim().min(1, "Competition name is required").max(COMPETITION_NAME_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable().default(null),
  scoring: scoringSchema,
  ruleOrder: ruleOrderSchema,
  presetRef: z.enum(["round_robin", "group_stage", "swiss_lite"]).nullable().default(null),
});

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(TEAM_NAME_MAX),
  shortName: z.string().trim().min(1).max(TEAM_SHORT_NAME_MAX).nullable().default(null),
  logoUrl: httpsUrlSchema.nullable().default(null),
});

const nonNegativeInt = (label: string) =>
  z.number().int(`${label} must be a whole number`).min(0, `${label} cannot be negative`);

export const resultSchema = z
  .object({
    teamAId: z.string().uuid("Invalid team"),
    teamBId: z.string().uuid("Invalid team"),
    winnerTeamId: z.string().uuid("Invalid winner").nullable().default(null),
    isDraw: z.boolean().default(false),
    mapsA: nonNegativeInt("Map score").nullable().default(null),
    mapsB: nonNegativeInt("Map score").nullable().default(null),
    roundsA: nonNegativeInt("Round score").nullable().default(null),
    roundsB: nonNegativeInt("Round score").nullable().default(null),
    playedAt: z.string().trim().max(40).nullable().default(null),
    notes: z.string().trim().max(NOTES_MAX, "Notes must be at most 500 characters").nullable().default(null),
    drawsEnabled: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.teamAId === val.teamBId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["teamBId"], message: "A team cannot play itself" });
    }
    if (val.isDraw && val.winnerTeamId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["winnerTeamId"], message: "A drawn match cannot have a winner" });
    }
    if (val.isDraw && !val.drawsEnabled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["isDraw"], message: "Draws are not enabled for this competition" });
    }
    // A missing winner without a draw is an incomplete result: persistable, but
    // excluded from standings until the winner is recorded. Lock requires an
    // explicit acknowledgment while incomplete results exist.
    if (val.winnerTeamId && val.winnerTeamId !== val.teamAId && val.winnerTeamId !== val.teamBId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["winnerTeamId"], message: "Winner must be one of the two teams" });
    }
    if (val.winnerTeamId === val.teamAId && val.mapsA !== null && val.mapsB !== null && val.mapsA < val.mapsB) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mapsA"], message: "Winner's map score cannot be lower than the loser's" });
    }
    if (val.winnerTeamId === val.teamBId && val.mapsA !== null && val.mapsB !== null && val.mapsB < val.mapsA) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mapsB"], message: "Winner's map score cannot be lower than the loser's" });
    }
    if (val.isDraw && val.mapsA !== null && val.mapsB !== null && val.mapsA !== val.mapsB) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mapsA"], message: "A drawn match needs equal map scores" });
    }
  });

export type CompetitionInput = z.infer<typeof competitionSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type ResultInput = z.infer<typeof resultSchema>;

export function isSupportedRuleId(value: string): boolean {
  return (RULE_IDS as readonly string[]).includes(value);
}
