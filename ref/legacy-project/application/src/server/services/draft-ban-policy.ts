import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlementError, forbiddenError, validationError } from "@/lib/errors";
import { getToolFreePolicy } from "@/config/tools/policy";
import { findToolBySlug } from "@/server/repositories/tools";

/**
 * Draft & Ban Free policy module (RCCF-DRAFT-BAN-FREE-IMPLEMENT-01).
 *
 * Owns only the Draft & Ban Free claim foundation: org-scoped Free
 * issuance for the generic claim dispatch. Nothing here enforces quotas,
 * history windows, template caps, branding, billing, or lifecycle
 * transitions — those belong to later phases.
 *
 * Nothing here generalizes: no universal quota, no cross-tool logic.
 * Sponsorship semantics (user grants, UTC month) are untouched — this module
 * never consults user_tool_entitlements. Tie-Breaker behavior is untouched.
 */

export const DRAFT_BAN_TOOL_SLUG = "draft-ban";

/** 1 completed official match per workspace-local calendar month. Descriptive only in this phase. */
export const FREE_DRAFT_BAN_COMPLETED_MATCHES_PER_MONTH = 1;

/** Free history shows the latest 5 completed official matches. Descriptive only in this phase. */
export const FREE_DRAFT_BAN_HISTORY_LIMIT = 5;

/** Free workspaces may keep 3 custom templates (starter templates never consume slots). Enforced; see template caps migration. */
export const FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX = 3;

/**
 * Free custom-template cap, sourced from the freemium policy registry
 * (src/config/tools/policy.ts → draft-ban limits.customTemplatesMax).
 * Falls back to FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX if the registry entry is
 * ever absent — fail closed, never unlimited. Business logic and UI must use
 * this (or customTemplatesMaxForLevel in template-service), never a literal.
 */
export function freeDraftBanCustomTemplatesMax(): number {
  const fromRegistry = getToolFreePolicy(DRAFT_BAN_TOOL_SLUG)?.limits.customTemplatesMax;
  return typeof fromRegistry === "number" ? fromRegistry : FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX;
}

/** Paid grant sources. Shared discriminator — never redefined elsewhere. */
export const DRAFT_BAN_PAID_SOURCES: ReadonlySet<string> = new Set(["subscription", "manual", "promo"]);

export type DraftBanAccessLevel = "paid" | "free" | "none";

function isUnexpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

interface OrgGrantRow {
  readonly id?: string;
  readonly is_all_access: boolean;
  readonly tool_id: string | null;
  readonly source: string;
  readonly expires_at: string | null;
}

async function draftBanToolId(supabase: SupabaseClient): Promise<string | null> {
  const tool = await findToolBySlug(supabase, DRAFT_BAN_TOOL_SLUG);
  return tool?.id ?? null;
}

/**
 * Resolve paid | free | none for an organization (org scope only — user
 * grants never unlock Draft & Ban).
 * Caller must establish membership first; this resolver decides the level,
 * never authorization.
 * 1. unexpired paid-source grant (per-tool or All Access) → paid
 * 2. unexpired source='free' grant (per-tool or All Access) → free
 * 3. otherwise none
 */
export async function resolveDraftBanAccessLevel(
  supabase: SupabaseClient,
  input: { organizationId: string },
): Promise<DraftBanAccessLevel> {
  try {
    const toolId = await draftBanToolId(supabase);
    if (!toolId) return "none";
    const { data, error } = await supabase
      .from("tool_entitlements")
      .select("is_all_access, tool_id, source, expires_at")
      .eq("organization_id", input.organizationId);
    if (error) throw error;
    const grants = ((data ?? []) as OrgGrantRow[]).filter((e) => isUnexpired(e.expires_at));
    const covers = (e: OrgGrantRow) => e.is_all_access || e.tool_id === toolId;
    if (grants.some((e) => covers(e) && DRAFT_BAN_PAID_SOURCES.has(e.source))) return "paid";
    if (grants.some((e) => covers(e) && e.source === "free")) return "free";
    return "none";
  } catch {
    return "none";
  }
}

/**
 * Idempotent Free issuance. Server-side callers only (service-role client):
 * RLS denies authenticated writes, so no user can self-grant.
 * - Unexpired per-tool grant (paid or Free) → return untouched (never downgrade).
 * - Unexpired paid coverage with no usable per-tool row (e.g. All Access) →
 *   return the paid row without minting a redundant Free grant.
 * - Otherwise → insert source='free', expires_at NULL (lifetime; later
 *   phases enforce monetization through quotas, not expiry).
 * Never creates user-level grants, orders, or billing records.
 */
export async function ensureFreeDraftBanGrant(supabase: SupabaseClient, organizationId: string) {
  const tool = await findToolBySlug(supabase, DRAFT_BAN_TOOL_SLUG);
  const toolId = tool?.id ?? null;
  if (!toolId) throw new Error("Draft & Ban tool is not registered");
  const { data: existing, error } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId)
    .eq("is_all_access", false)
    .eq("tool_id", toolId)
    .maybeSingle();
  if (error) throw error;
  const row = existing as OrgGrantRow | null;
  if (row && isUnexpired(row.expires_at)) return row;
  const { data: covering, error: coveringError } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId);
  if (coveringError) throw coveringError;
  const paid = ((covering ?? []) as OrgGrantRow[]).find(
    (e) =>
      isUnexpired(e.expires_at) &&
      DRAFT_BAN_PAID_SOURCES.has(e.source) &&
      (e.is_all_access || e.tool_id === toolId),
  );
  if (paid) return (row ?? paid) as OrgGrantRow;
  const { data, error: upsertError } = await supabase
    .from("tool_entitlements")
    .upsert(
      { organization_id: organizationId, tool_id: toolId, is_all_access: false, source: "free", expires_at: null },
      { onConflict: "organization_id,tool_id" },
    )
    .select("id, is_all_access, tool_id, source, expires_at")
    .single();
  if (upsertError) throw upsertError;
  return data as OrgGrantRow;
}

// ── Quota error + RPC mapping ──

export const DRAFT_BAN_QUOTA_MESSAGE =
  "You've used your free Draft & Ban completion for this month. Upgrade for unlimited official matches.";

export type DraftBanQuotaKind = "completions";

export function draftBanQuotaError() {
  return validationError(DRAFT_BAN_QUOTA_MESSAGE, { draftBanQuota: "completions" satisfies DraftBanQuotaKind });
}

export function isDraftBanQuotaError(e: unknown): boolean {
  const details = (e as { details?: unknown })?.details as { draftBanQuota?: unknown } | undefined;
  return details?.draftBanQuota === "completions";
}

const DRAFT_BAN_DENIAL_MESSAGE =
  "This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.";

/** Map consume_draft_ban_completion SQLSTATEs onto the existing domain errors. */
export function mapConsumeDraftBanCompletionError(error: unknown): Error {
  const code = (error as { code?: unknown })?.code;
  const rawMessage = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
  const message = typeof rawMessage === "string" ? rawMessage : String(error ?? "");
  if (code === "DBQ01" || message.includes("quota_exceeded")) return draftBanQuotaError();
  if (code === "DBN01" || message.includes("no_access")) {
    if (message.includes("not a member")) return forbiddenError("You don't have access to this workspace.");
    return entitlementError(DRAFT_BAN_DENIAL_MESSAGE);
  }
  if (code === "DBD01" || message.includes("invalid:")) {
    if (message.includes("in-progress")) return validationError("This match cannot be completed right now.");
    return validationError("Something went wrong. Please try again.");
  }
  if (error instanceof Error) return error;
  return new Error(message || "Completion failed");
}

// ── Custom-template cap error + RPC mapping ──

export const DRAFT_BAN_TEMPLATE_LIMIT_MESSAGE =
  "You've reached the custom template limit for your plan. Upgrade to raise the limit.";

export type DraftBanTemplateLimitKind = "custom-templates";

export function draftBanTemplateLimitError(customMax: number) {
  return validationError(DRAFT_BAN_TEMPLATE_LIMIT_MESSAGE, {
    draftBanTemplateLimit: "custom-templates" satisfies DraftBanTemplateLimitKind,
    customMax,
  });
}

export function isDraftBanTemplateLimitError(e: unknown): boolean {
  const details = (e as { details?: unknown })?.details as { draftBanTemplateLimit?: unknown } | undefined;
  return details?.draftBanTemplateLimit === "custom-templates";
}

/** Map create_draft_template SQLSTATEs onto the existing domain errors. */
export function mapCreateDraftTemplateError(error: unknown, customMax: number): Error {
  const code = (error as { code?: unknown })?.code;
  const rawMessage = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
  const message = typeof rawMessage === "string" ? rawMessage : String(error ?? "");
  if (code === "DBT01" || message.includes("template_limit_exceeded")) return draftBanTemplateLimitError(customMax);
  if (code === "DBT02" || message.includes("duplicate_template")) {
    return validationError("A template with this name already exists");
  }
  if (code === "23505" || message.includes("draft_templates_org_name_unique")) {
    return validationError("A template with this name already exists");
  }
  if (code === "DBN01" || message.includes("no_access")) {
    if (message.includes("not a member")) return forbiddenError("You don't have access to this workspace.");
    return entitlementError(DRAFT_BAN_DENIAL_MESSAGE);
  }
  if (error instanceof Error) return error;
  return new Error(message || "Template creation failed");
}

// ── Paid-only branding (organization logo in Draft & Ban outputs) ──

/**
 * Branding gate for Draft & Ban official/shareable outputs. Branding is live:
 * outputs read the organization's current logo_url, and paid access at
 * render/share time controls exposure — no snapshot is stored.
 * Paid (per-tool or All Access) → current logo (or null when none set).
 * Anything else (free, expired, none) → null. Never throws; fail closed.
 * Callers must resolve the level server-side via resolveDraftBanAccessLevel —
 * never from browser input.
 */
export function draftBanResultLogoUrl(
  accessLevel: DraftBanAccessLevel,
  logoUrl: string | null | undefined,
): string | null {
  if (accessLevel !== "paid") return null;
  return logoUrl ?? null;
}
