import { TOOLS } from "@/config/app/tools";
import { getToolFreePolicy } from "@/config/tools/policy";
import { claimFreeTool } from "@/server/services/tool-claim";

/**
 * Starter Free provisioning (RCCF-FIRST-VALUE-FIX-03 F1).
 *
 * New workspaces arrive with their Free tools already available: after
 * `createOrganizationForUser` succeeds, the creation action calls
 * `provisionStarterFreeGrants` once with the new workspace slug.
 *
 * Canonical path only: every grant flows through `claimFreeTool` — the
 * same membership-first, policy-gated, idempotent, never-downgrades-paid
 * dispatch the manual "Start free" cards use. This service adds no
 * issuance logic of its own, so Free limits, paid/All Access precedence,
 * and commercial availability cannot drift between auto and manual paths.
 *
 * Best-effort by design: one tool's failure never blocks the others, and
 * the per-tool claim cards remain as fallback for anything skipped here.
 * Provisioning must never fail workspace creation — callers wrap in
 * try/catch and continue to the workspace on error.
 */

export interface SkippedFreeGrant {
  readonly toolSlug: string;
  readonly reason: string;
}

export interface FreeProvisioningResult {
  /** Tool slugs whose Free grant is now ensured (already-held counts). */
  readonly granted: string[];
  /** Tools to surface via the manual claim fallback. */
  readonly skipped: SkippedFreeGrant[];
}

/**
 * Tool slugs eligible for automatic provisioning. Derived live from the
 * app tool registry (commercial availability) and the Free-policy
 * registry (Free-enabled + claimable) — never a hardcoded list, so
 * removed/unreleased tools are excluded by construction.
 */
export function starterFreeToolSlugs(): string[] {
  return TOOLS.filter((t) => {
    if (t.comingSoon) return false;
    const policy = getToolFreePolicy(t.slug);
    return Boolean(policy && policy.freeEnabled && policy.claimable);
  }).map((t) => t.slug);
}

export async function provisionStarterFreeGrants(orgSlug: string): Promise<FreeProvisioningResult> {
  const granted: string[] = [];
  const skipped: SkippedFreeGrant[] = [];
  for (const toolSlug of starterFreeToolSlugs()) {
    try {
      const res = await claimFreeTool(toolSlug, orgSlug);
      if (res?.ok) {
        granted.push(toolSlug);
      } else {
        skipped.push({ toolSlug, reason: res?.error ?? "Free grant not ensured" });
      }
    } catch (e) {
      skipped.push({ toolSlug, reason: e instanceof Error ? e.message : "Free grant not ensured" });
    }
  }
  return { granted, skipped };
}
