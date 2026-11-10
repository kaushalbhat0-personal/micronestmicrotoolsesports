"use client";

import * as React from "react";
import { ToolClaimCard } from "@/components/freemium/tool-claim-card";
import { claimFreeSponsorshipAction } from "../actions/free-tier-actions";

/**
 * Free claim affordance for the Sponsorship Tracking denied surfaces.
 * Same activation path as every other released tool: canonical badge +
 * allowance via `ToolClaimCard`, issuance in the generic claim dispatch
 * (user-scoped grant, server-side). Claiming only unlocks the workspace —
 * connecting a creator channel is still required before checks can run.
 */
export function ClaimFreeSponsorshipCard({ orgSlug }: { orgSlug: string }) {
  return (
    <ToolClaimCard
      toolSlug="sponsor-sentinel"
      toolName="Sponsorship Tracking"
      description="Verify sponsor requirements and keep proof organized. Then connect a creator channel to start tracking."
      successMessage="Free plan active. Now connect a creator channel to start tracking."
      orgSlug={orgSlug}
      claimAction={claimFreeSponsorshipAction}
    />
  );
}
