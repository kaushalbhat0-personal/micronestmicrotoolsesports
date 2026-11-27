"use client";

import * as React from "react";
import { ToolClaimCard } from "@/components/freemium/tool-claim-card";
import { claimFreeTieBreakerAction } from "../actions/competition-actions";

/**
 * Free claim affordance for the Tie-Breaker denied surface.
 * Thin binder: canonical badge + allowance render via `ToolClaimCard`;
 * issuance stays in the generic claim dispatch (server-side).
 */
export function ClaimFreeTieBreakerCard({ orgSlug }: { orgSlug: string }) {
  return (
    <ToolClaimCard
      toolSlug="tie-breaker"
      toolName="Tie-Breaker Resolver"
      description="Settle tied standings and lock shareable official records."
      successMessage="Free plan active. You can now lock up to 3 official records this month."
      orgSlug={orgSlug}
      claimAction={claimFreeTieBreakerAction}
    />
  );
}
