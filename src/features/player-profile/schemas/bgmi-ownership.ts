import { z } from "zod";
import {
  BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES,
  BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
} from "../domain/bgmi-ownership";

export const BGMI_OWNERSHIP_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const bgmiOwnershipContentTypeSchema = z.enum(BGMI_OWNERSHIP_ALLOWED_MIME);

export const bgmiOwnershipCaseIdSchema = z.string().uuid();

export const bgmiOwnershipEvidenceIdSchema = z.string().uuid();

export const bgmiOwnershipUploadInputSchema = z
  .object({
    caseId: bgmiOwnershipCaseIdSchema,
    bytes: z.instanceof(Uint8Array),
  })
  .strict();

export const bgmiOwnershipSignedUrlInputSchema = z
  .object({
    caseId: bgmiOwnershipCaseIdSchema,
    evidenceId: bgmiOwnershipEvidenceIdSchema,
  })
  .strict();

export const BGMI_OWNERSHIP_MIN_DIMENSION = 64;
export const BGMI_OWNERSHIP_MAX_DIMENSION = 8192;
export const BGMI_OWNERSHIP_MAX_PIXELS = 25_000_000;

export const BGMI_OWNERSHIP_RATE_LIMITS = {
  create_case: { limit: 5, windowSeconds: 3600 },
  upload: { limit: 10, windowSeconds: 900 },
  submit: { limit: 5, windowSeconds: 3600 },
  withdraw: { limit: 20, windowSeconds: 3600 },
  signed_url: { limit: 30, windowSeconds: 900 },
} as const;

export {
  BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES,
  BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
};
