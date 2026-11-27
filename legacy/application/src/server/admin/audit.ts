import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side audit helper — Super Admin only.
 *
 * Security:
 * - Calls requireSuperAdmin() (401 anonymous, 403 non-admin) before any write.
 * - Uses service_role (bypasses RLS) only after authorization.
 * - Never callable from client components — import only in server contexts.
 * - Does not store secrets; caller must ensure before/after contain only safe summaries.
 */

const ACTION_RE = /^[a-z_]+\.[a-z_]+$/;

const FORBIDDEN_KEYS = [
  "password",
  "password_hash",
  "access_token",
  "refresh_token",
  "oauth_token",
  "secret",
  "webhook_secret",
  "razorpay_signature",
  "service_role",
  "supabase_service_role_key",
  "api_key",
];

function containsForbiddenKeys(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    const lower = k.toLowerCase();
    for (const f of FORBIDDEN_KEYS) {
      if (lower.includes(f)) return k;
    }
    // recurse one level for nested objects
    const v = rec[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = containsForbiddenKeys(v);
      if (nested) return `${k}.${nested}`;
    }
  }
  return null;
}

export interface RecordAdminAuditInput {
  action: string;
  targetType: string;
  targetId?: string | null;
  organizationId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
}

/**
 * Record an admin audit event.
 * Must be called from server code that has already established request context.
 * The function itself re-verifies Super Admin to prevent accidental bypass.
 */
export async function recordAdminAudit(input: RecordAdminAuditInput): Promise<{ id: string }> {
  const actor = await requireSuperAdmin();

  if (!ACTION_RE.test(input.action)) {
    const { validationError } = await import("@/lib/errors");
    throw validationError(`Invalid action format: ${input.action} (expected resource.action)`);
  }

  if (!input.targetType || input.targetType.trim().length < 2 || input.targetType.length > 40) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid target_type");
  }

  // Safety: reject audit payloads that contain secrets
  if (input.before) {
    const bad = containsForbiddenKeys(input.before);
    if (bad) throw new Error(`Audit before contains forbidden key: ${bad}`);
  }
  if (input.after) {
    const bad = containsForbiddenKeys(input.after);
    if (bad) throw new Error(`Audit after contains forbidden key: ${bad}`);
  }

  // Validate IP if provided — must be plausible inet, not arbitrary string
  let ip: string | null = null;
  if (input.ip) {
    // Basic IPv4/IPv6 check — allow null if not trustworthy
    const ipTrim = input.ip.trim();
    // Simple check: contains dots or colons, no spaces, length <45
    if (/^[0-9a-fA-F:.]+$/.test(ipTrim) && ipTrim.length < 45) {
      ip = ipTrim;
    }
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("admin_audit_logs")
    .insert({
      actor_user_id: actor.id,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      organization_id: input.organizationId ?? null,
      reason: input.reason?.slice(0, 500) ?? null,
      before: input.before ? (input.before as unknown as never) : null,
      after: input.after ? (input.after as unknown as never) : null,
      ip: ip as unknown as never,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to record audit: ${error?.message ?? "unknown"}`);
  }

  return { id: (data as { id: string }).id };
}

/**
 * Helper to extract trustworthy IP from Next.js request headers.
 * Call inside Route Handler / Server Action where headers() is available.
 * Returns null if not available or untrustworthy.
 *
 * Usage:
 *   const ip = await getRequestIp(); // from next/headers
 *   await recordAdminAudit({ action: "entitlement.grant", ..., ip });
 */
export async function getRequestIp(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const hdrs = await headers();
    const forwarded = hdrs.get("x-forwarded-for");
    if (forwarded) {
      // x-forwarded-for: client, proxy1, proxy2 — first is client
      const first = forwarded.split(",")[0]?.trim();
      if (first && /^[0-9a-fA-F:.]+$/.test(first)) return first;
    }
    const real = hdrs.get("x-real-ip");
    if (real && /^[0-9a-fA-F:.]+$/.test(real.trim())) return real.trim();
    return null;
  } catch {
    return null;
  }
}
