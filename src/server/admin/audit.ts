// D1 admin/audit foundation — pure helpers (REIMPLEMENT design, no DB in D1).
// Legacy reference:
// - legacy/application/src/server/admin/audit.ts
// - legacy/application/src/server/admin/platform-admins.ts
// - legacy/application/src/server/cron/run-ledger.ts
// D1 scope: validation + redaction primitives only. No service-role, no RPCs,
// no admin dashboard. DB objects land in 20261112000001_d1_admin_foundation.sql
// (pending acceptance, NOT applied in D1).

export const ADMIN_ACTION_RE = /^[a-z_]+\.[a-z_]+$/;

const FORBIDDEN_KEY_PARTS = [
  "password",
  "secret",
  "token",
  "session",
  "hash",
  "api_key",
  "service_role",
  "signature",
] as const;

export function isValidAdminAction(action: string): boolean {
  return ADMIN_ACTION_RE.test(action);
}

export function isValidTargetType(targetType: string): boolean {
  const t = targetType.trim();
  return t.length >= 2 && t.length <= 40;
}

export function requireAdminReason(reason: string): string {
  const clean = reason.trim().slice(0, 500);
  if (clean.length < 5) throw new Error("A reason of at least 5 characters is required");
  return clean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function containsForbiddenKey(obj: unknown): string | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    const lower = key.toLowerCase();
    for (const part of FORBIDDEN_KEY_PARTS) {
      if (lower.includes(part)) return key;
    }
    const nested = containsForbiddenKey(rec[key]);
    if (nested) return `${key}.${nested}`;
  }
  return null;
}

export function findForbiddenAuditKey(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string | null {
  return containsForbiddenKey(before) ?? containsForbiddenKey(after);
}

const MAX_PROJECTION_KEYS = 40;
const MAX_PROJECTION_ENTRIES = 20;
const MAX_VALUE_CHARS = 200;

/**
 * Safe audit projection: redacts forbidden keys, caps size. Mirrors legacy
 * safeAuditProjection bounds without importing legacy code.
 */
export function projectAuditValue(value: unknown): { text: string; omitted: boolean } {
  if (value === null || value === undefined) return { text: "", omitted: false };
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const text = raw ?? "";
  if (text.length <= MAX_VALUE_CHARS) return { text, omitted: false };
  return { text: text.slice(0, MAX_VALUE_CHARS), omitted: true };
}

export interface AuditProjection {
  readonly entries: ReadonlyArray<{ key: string; text: string }>;
  readonly omittedKeys: number;
  readonly truncatedValues: number;
}

export function projectAuditRecord(record: Record<string, unknown>): AuditProjection {
  const keys = Object.keys(record).slice(0, MAX_PROJECTION_KEYS);
  const omittedKeys = Math.max(0, Object.keys(record).length - keys.length);
  const entries: Array<{ key: string; text: string }> = [];
  let truncatedValues = 0;
  for (const key of keys.slice(0, MAX_PROJECTION_ENTRIES)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEY_PARTS.some((part) => lower.includes(part))) continue;
    const { text, omitted } = projectAuditValue(record[key]);
    entries.push({ key, text });
    if (omitted) truncatedValues++;
  }
  return { entries, omittedKeys, truncatedValues };
}

export type CronStatus = "running" | "succeeded" | "failed";

export function isValidCronJobId(jobId: string): boolean {
  const t = jobId.trim();
  return t.length >= 2 && t.length <= 120;
}

export function isValidCronRunId(runId: string): boolean {
  const t = runId.trim();
  return t.length >= 2 && t.length <= 120;
}
