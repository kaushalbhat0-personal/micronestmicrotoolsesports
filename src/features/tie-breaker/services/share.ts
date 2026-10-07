import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tie-Breaker Resolver — Public share boundary (foundation).
 *
 * Locked records only, via get_completed_tie_breaker_share(p_token).
 * Allowlisted DTO: competition name/description, record number, locked
 * timestamp, rule/scoring summary, frozen snapshot, org name/logo.
 * Never: organization_id, created_by, private notes, incomplete-result
 * warnings, internal IDs, draft/active records.
 */

const tokenSchema = z.string().uuid("Invalid share link");

const ruleIdSchema = z.enum(["points", "h2h", "map_diff", "round_diff", "wins"]);

const standingsEntrySchema = z.object({
  teamId: z.string().min(1),
  position: z.number().int().min(1),
  points: z.number(),
  wins: z.number().int().min(0),
  draws: z.number().int().min(0),
  losses: z.number().int().min(0),
  mapDiff: z.number(),
  roundDiff: z.number(),
  decisiveRule: ruleIdSchema.optional(),
  tied: z.boolean(),
  tiedWith: z.array(z.string()),
});

const explanationSchema = z.object({
  scope: z.enum(["separation", "unresolved"]),
  teamIds: z.array(z.string().min(1)).min(1),
  decisiveRule: ruleIdSchema.optional(),
  summary: z.string().min(1).max(2000),
});

export const shareRecordSchema = z
  .object({
    record_number: z.string().regex(/^TB-\d{4}-\d{5}$/),
    competition_name: z.string().min(1).max(80),
    description: z.string().max(500).nullable(),
    locked_at: z.string().min(1),
    rule_order: z.array(ruleIdSchema).min(1).max(5),
    scoring: z.object({
      win: z.number().int().min(0).max(10),
      draw: z.number().int().min(0).max(10),
      loss: z.number().int().min(0).max(10),
      draws_enabled: z.boolean(),
      round_label: z.enum(["rounds", "games"]),
    }),
    snapshot: z
      .object({
        standings: z.array(standingsEntrySchema).min(2).max(32),
        explanations: z.array(explanationSchema).min(1),
        teamNames: z.record(z.string().min(1), z.string().min(1).max(60)),
      })
      .passthrough(),
    organization_name: z.string().min(1).max(80),
    // https-only: zod .url() accepts javascript:/data: schemes, which must never render as a logo.
    organization_logo_url: z
      .string()
      .url()
      .max(500)
      .refine((u) => u.startsWith("https://"), "Logo URL must use https")
      .nullable(),
  })
  .strict();

export type TieBreakerShareRecord = z.infer<typeof shareRecordSchema>;

export function parseTieBreakerShareToken(raw: unknown): string {
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid share link");
  return parsed.data;
}

/** Locked-only lookup through the narrow RPC. Returns null when not shareable. */
export async function fetchCompletedTieBreakerShare(
  adminClient: SupabaseClient,
  token: string,
): Promise<TieBreakerShareRecord | null> {
  const { data, error } = await adminClient.rpc("get_completed_tie_breaker_share", { p_token: token });
  if (error || !data) return null;
  const parsed = shareRecordSchema.safeParse(data);
  if (!parsed.success) return null;
  return parsed.data;
}
