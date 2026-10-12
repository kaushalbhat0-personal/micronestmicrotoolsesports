import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Prize Payout Tracker — public share boundary.
 *
 * Published/completed trackers only, via get_published_payout_tracker(p_token).
 * Allowlisted DTO: event name, currency, deadline, status, timestamps at
 * public granularity, org name, recipient rows (name/amount/status/paid
 * date/last-4/proof link). Never: organization_id, created_by, internal
 * tracker/recipient IDs, membership, or billing data. Only reference_last4
 * exists — a full reference is never stored, so it can never leak.
 */

const tokenSchema = z.string().uuid("Invalid share link");

/**
 * Day-granular public date (YYYY-MM-DD). The share RPC casts every
 * timestamp to PostgreSQL date, so no hours/minutes/seconds/timezone
 * precision ever leaves the database.
 */
const publicDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid public date");

const recipientShareSchema = z.object({
  recipient_name: z.string().min(1).max(60),
  amount_minor: z.number().int().positive(),
  status: z.enum(["pending", "paid"]),
  paid_at: publicDateSchema.nullable(),
  reference_last4: z
    .string()
    .regex(/^[A-Za-z0-9]{4}$/)
    .nullable(),
  // https-only: zod .url() accepts javascript:/data: schemes, which must never render as a link.
  proof_url: z
    .string()
    .url()
    .max(500)
    .refine((u) => u.startsWith("https://"), "Proof link must use https")
    .nullable(),
});

export const shareRecordSchema = z
  .object({
    event_name: z.string().min(1).max(80),
    currency: z.enum(["INR", "USD", "EUR", "GBP"]),
    deadline: publicDateSchema.nullable(),
    status: z.enum(["published", "completed"]),
    published_at: publicDateSchema,
    completed_at: publicDateSchema.nullable(),
    updated_at: publicDateSchema,
    organization_name: z.string().min(1).max(80),
    recipients: z.array(recipientShareSchema).min(1).max(200),
  })
  .strict();

export type PayoutShareRecord = z.infer<typeof shareRecordSchema>;

export function parsePayoutShareToken(raw: unknown): string {
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid share link");
  return parsed.data;
}

/** Published-only lookup through the narrow RPC. Returns null when not shareable. */
export async function fetchPublishedPayoutShare(
  adminClient: SupabaseClient,
  token: string,
): Promise<PayoutShareRecord | null> {
  const { data, error } = await adminClient.rpc("get_published_payout_tracker", { p_token: token });
  if (error || !data) return null;
  const parsed = shareRecordSchema.safeParse(data);
  if (!parsed.success) return null;
  return parsed.data;
}

export function shareUrlForToken(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/share/payout/${token}`;
}
