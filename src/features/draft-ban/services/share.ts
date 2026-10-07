import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Draft & Ban — Public share record.
 * Completed matches only. Narrow allowlisted DTO via
 * get_completed_draft_share(p_token). Never select * and never expose
 * organization_id / created_by / notes.
 */

const tokenSchema = z.string().uuid("Invalid share link");

const shareStepSchema = z.object({ team: z.enum(["A", "B"]), type: z.enum(["ban", "pick"]) });
const shareActionSchema = z.object({
  stepIndex: z.number().int().min(0),
  team: z.enum(["A", "B"]),
  type: z.enum(["ban", "pick"]),
  item: z.string().min(1).max(60),
  at: z.string().min(1),
});

export const shareRecordSchema = z.object({
  ref_code: z.string().regex(/^DB-\d{4}-\d{5}$/),
  match_name: z.string().nullable(),
  event_name: z.string().nullable(),
  format_label: z.string().nullable(),
  team_a: z.string().min(1).max(40),
  team_b: z.string().min(1).max(40),
  sequence: z.array(shareStepSchema).min(1).max(100),
  pool: z.array(z.string().min(1).max(60)).min(2).max(100),
  actions: z.array(shareActionSchema).max(100),
  completed_at: z.string().min(1),
  organization_name: z.string().min(1).max(80),
  // https-only: zod .url() accepts javascript:/data: schemes, which must never render as a logo.
  organization_logo_url: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://"), "Logo URL must use https")
    .nullable(),
}).strict();

export type ShareRecord = z.infer<typeof shareRecordSchema>;

export function parseShareToken(raw: unknown): string {
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid share link");
  return parsed.data;
}

/** Completed-only lookup through the narrow RPC. Returns null when not shareable. */
export async function fetchCompletedShareRecord(adminClient: SupabaseClient, token: string): Promise<ShareRecord | null> {
  const { data, error } = await adminClient.rpc("get_completed_draft_share", { p_token: token });
  if (error || !data) return null;
  const parsed = shareRecordSchema.safeParse(data);
  if (!parsed.success) return null;
  // Defense-in-depth: share only fully completed sequences.
  if (parsed.data.actions.length !== parsed.data.sequence.length) return null;
  return parsed.data;
}
