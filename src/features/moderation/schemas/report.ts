// P10 report-intake + review-decision schemas — strict validation contracts
// for the DISABLED moderation shell. Protected keys (reporter/reviewer
// identity, timestamps, status, resolution internals) are REJECTED, never
// silently dropped. Money/URL/timezone shapes follow the P9 managed-tournament
// contracts; descriptions are tightly bounded to prevent PII dumps.

import { z } from "zod";
import { organizerSlugSchema } from "@/features/organizers/schemas/manage";
import {
  MAX_DECISION_REASON_LENGTH,
  MIN_DECISION_REASON_LENGTH,
  MODERATION_DECISIONS,
} from "../domain/decision";
import {
  MAX_REPORT_DESCRIPTION_LENGTH,
  MIN_REPORT_DESCRIPTION_LENGTH,
  MAX_RESOLUTION_REASON_LENGTH,
  MIN_RESOLUTION_REASON_LENGTH,
  REPORTABLE_ENTITY_TYPES,
  REPORT_CATEGORIES,
  REPORT_RESOLUTIONS,
} from "../domain/report";

const descriptionSchema = z
  .string()
  .trim()
  .min(MIN_REPORT_DESCRIPTION_LENGTH)
  .max(MAX_REPORT_DESCRIPTION_LENGTH);

export const submitReportInputSchema = z
  .object({
    entityType: z.enum(REPORTABLE_ENTITY_TYPES),
    /** Public slug of the reported tournament or organizer. Never an internal id. */
    entitySlug: organizerSlugSchema,
    category: z.enum(REPORT_CATEGORIES),
    description: descriptionSchema,
  })
  .strict();

export type SubmitReportInput = z.infer<typeof submitReportInputSchema>;

export const reviewReportInputSchema = z
  .object({
    /** Queue row id (uuid). Reporter never supplies it; reviewer selects from the queue. */
    reportId: z.string().uuid(),
    resolution: z.enum(REPORT_RESOLUTIONS),
    reason: z
      .string()
      .trim()
      .min(MIN_RESOLUTION_REASON_LENGTH)
      .max(MAX_RESOLUTION_REASON_LENGTH),
  })
  .strict();

export type ReviewReportInput = z.infer<typeof reviewReportInputSchema>;

export const moderationDecisionInputSchema = z
  .object({
    /** Managed tournament id (uuid). Lifecycle values are never accepted as input. */
    tournamentId: z.string().uuid(),
    decision: z.enum(MODERATION_DECISIONS),
    reason: z
      .string()
      .trim()
      .min(MIN_DECISION_REASON_LENGTH)
      .max(MAX_DECISION_REASON_LENGTH),
  })
  .strict();

export type ModerationDecisionInput = z.infer<typeof moderationDecisionInputSchema>;

export const verificationSubmitInputSchema = z
  .object({
    /** Managed organizer id (uuid). Trust states are never accepted as input. */
    organizerId: z.string().uuid(),
  })
  .strict();

export type VerificationSubmitInput = z.infer<typeof verificationSubmitInputSchema>;
