import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_ACCESS_SLUG, TOOLS } from "@/config/app/tools";
import { getToolFreePolicy } from "@/config/tools/policy";
import { findToolBySlug } from "@/server/repositories/tools";
import {
  SPONSORSHIP_TOOL_SLUG,
  ensureSponsorshipPolicyFreeGrant,
} from "@/server/services/sponsorship-policy";
import {
  TIE_BREAKER_TOOL_SLUG,
  ensureFreeTieBreakerGrant,
} from "@/server/services/tie-breaker-policy";
import {
  DRAFT_BAN_TOOL_SLUG,
  ensureFreeDraftBanGrant,
} from "@/server/services/draft-ban-policy";
import { AppError } from "@/lib/errors";

/**
 * Generic Free claim dispatch (freemium platform, Phase 3 + Tie-Breaker Free).
 *
 * Claims Free access for a policy-enabled tool without payment, orders,
 * or billing changes. Gates are generic; issuance delegates to the
 * tool's policy module (Sponsorship user grants, Tie-Breaker and Draft & Ban
 * org grants).
 *
 * Requirements enforced here, in order:
 * - membership first (via organization context — same precedence as before)
 * - policy must exist and be Free-enabled + claimable
 * - All Access can never be claimed
 * - tool must be commercially available (registry + active DB row)
 * - identity is server-derived (`ctx.user.id`), never client input
 * - issuance is idempotent and never downgrades paid grants
 */

const UNAVAILABLE_MESSAGE = "This tool isn't available for Free access.";

export async function claimFreeTool(
  toolSlug: string,
  orgSlug: string
): Promise<{ ok?: boolean; error?: string }> {
  if (!orgSlug) return { error: "Missing organization" };
  try {
    // Membership first — identical precedence to the legacy claim action.
    const ctx = await requireOrganizationContext(orgSlug);

    const policy = getToolFreePolicy(toolSlug);
    if (!policy || !policy.freeEnabled || !policy.claimable) {
      return { error: UNAVAILABLE_MESSAGE };
    }
    if (toolSlug === ALL_ACCESS_SLUG) {
      return { error: UNAVAILABLE_MESSAGE };
    }
    const catalog = TOOLS.find((t) => t.slug === toolSlug);
    if (!catalog || catalog.comingSoon) {
      return { error: UNAVAILABLE_MESSAGE };
    }
    const admin = createAdminClient();
    const tool = await findToolBySlug(admin as never, toolSlug);
    if (!tool || !tool.is_active) {
      return { error: UNAVAILABLE_MESSAGE };
    }
    if (policy.toolSlug === SPONSORSHIP_TOOL_SLUG) {
      await ensureSponsorshipPolicyFreeGrant(admin as never, ctx.user.id);
      return { ok: true };
    }
    if (policy.toolSlug === TIE_BREAKER_TOOL_SLUG) {
      await ensureFreeTieBreakerGrant(admin as never, ctx.organization.id);
      return { ok: true };
    }
    if (policy.toolSlug === DRAFT_BAN_TOOL_SLUG) {
      await ensureFreeDraftBanGrant(admin as never, ctx.organization.id);
      return { ok: true };
    }
    return { error: UNAVAILABLE_MESSAGE };
  } catch (e) {
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[claimFreeTool] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}
