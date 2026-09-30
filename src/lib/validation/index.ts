import { z } from "zod";
import { validationError } from "@/lib/errors";

/**
 * Parse helper — throws AppError (400) on failure with safe details.
 * Use for API payloads, search params, form data, env, webhooks.
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw validationError("Validation failed", result.error.flatten());
  }
  return result.data;
}

// ── Common schemas ────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const organizationSlugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens");

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(80),
  slug: organizationSlugSchema,
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(80).optional(),
});

export const toolSlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .describe("Tool slug, e.g., sponsor-sentinel");

// Safe redirect check for auth callbacks
export function isSafeRedirect(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("://");
}
