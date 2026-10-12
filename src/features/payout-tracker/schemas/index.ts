import { z } from "zod";
import { MAX_RECIPIENT_AMOUNT_MAJOR } from "../types";

/**
 * Prize Payout Tracker — validation single source.
 * Every action/service parses through these schemas via parseOrThrow.
 * Only the last 4 reference characters are ever accepted — there is no
 * schema, column, or code path for a full UTR in V1.
 */

export const currencySchema = z.enum(["INR", "USD", "EUR", "GBP"]);

export const eventNameSchema = z.string().trim().min(1, "Event name is required").max(80, "Event name must be at most 80 characters");

export const recipientNameSchema = z
  .string()
  .trim()
  .min(1, "Recipient name is required")
  .max(60, "Recipient name must be at most 60 characters");

/** Major-unit amount: positive, finite, capped, at most 2 decimals (minor-exact). */
export const amountMajorSchema = z
  .number({ invalid_type_error: "Amount must be a number" })
  .finite("Amount must be a finite number")
  .positive("Amount must be greater than 0")
  .max(MAX_RECIPIENT_AMOUNT_MAJOR, "Amount is too large")
  .refine((n) => Math.round(n * 100) / 100 === n, "Amount can have at most 2 decimal places");

/** Last 4 of UTR / payment reference — exactly 4 alphanumerics. Empty means absent. */
export const referenceLast4Schema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{4}$/, "Reference must be exactly the last 4 characters (letters/digits)");

function blankTo(value: unknown, blank: undefined | null): unknown {
  if (typeof value !== "string") return value;
  return value.trim() === "" ? blank : value.trim();
}

export const optionalReferenceLast4Schema = z.preprocess(
  (v) => blankTo(v, undefined),
  referenceLast4Schema.optional(),
);

// https-only: zod .url() accepts javascript:/data: schemes, which must never
// be stored or rendered as a proof link. Empty means absent.
export const proofUrlSchema = z
  .string()
  .trim()
  .url("Proof link must be a valid URL")
  .max(500, "Proof link is too long")
  .refine((u) => u.startsWith("https://"), "Proof link must use https");

export const optionalProofUrlSchema = z.preprocess(
  (v) => blankTo(v, undefined),
  proofUrlSchema.nullable().optional(),
);

/** Deadline from a date input (YYYY-MM-DD) or null when unset. */
export const deadlineSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Deadline must be a calendar date")
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), "Deadline must be a real date");

export const optionalDeadlineSchema = z.preprocess(
  (v) => blankTo(v, undefined),
  deadlineSchema.nullable().optional(),
);

export const recipientInputSchema = z.object({
  name: recipientNameSchema,
  amountMajor: amountMajorSchema,
});

export const createTrackerSchema = z.object({
  eventName: eventNameSchema,
  currency: currencySchema,
  deadline: optionalDeadlineSchema,
  recipients: z
    .array(recipientInputSchema)
    .min(1, "Add at least one recipient")
    .max(200, "Too many recipients in one request"),
});

export const updateTrackerSchema = z.object({
  eventName: eventNameSchema,
  deadline: optionalDeadlineSchema,
});

export const addRecipientSchema = z.object({
  name: recipientNameSchema,
  amountMajor: amountMajorSchema,
  referenceLast4: optionalReferenceLast4Schema,
  proofUrl: optionalProofUrlSchema,
});

export const updateRecipientSchema = z.object({
  name: recipientNameSchema,
  amountMajor: amountMajorSchema,
  referenceLast4: z.preprocess((v) => blankTo(v, null), referenceLast4Schema.nullable()),
  proofUrl: z.preprocess((v) => blankTo(v, null), proofUrlSchema.nullable()),
});

export const trackerIdSchema = z.string().uuid("Invalid tracker");

export const recipientIdSchema = z.string().uuid("Invalid recipient");

export const recipientStatusSchema = z.enum(["pending", "paid"]);

export type CreateTrackerInput = z.infer<typeof createTrackerSchema>;
export type UpdateTrackerInput = z.infer<typeof updateTrackerSchema>;
export type AddRecipientInput = z.infer<typeof addRecipientSchema>;
export type UpdateRecipientInput = z.infer<typeof updateRecipientSchema>;
