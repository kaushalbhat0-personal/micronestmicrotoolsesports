"use client";

import * as React from "react";
import { ToolClaimCard } from "@/components/freemium/tool-claim-card";
import { claimFreePayoutTrackerAction } from "../actions/claim-actions";

/**
 * Free claim affordance for the Prize Payout Tracker denied surface.
 * Thin binder: canonical badge + allowance render via `ToolClaimCard`;
 * issuance stays in the generic claim dispatch (server-side).
 */
export function ClaimFreePayoutTrackerCard({ orgSlug }: { orgSlug: string }) {
  return (
    <ToolClaimCard
      toolSlug="payout-tracker"
      toolName="Prize Payout Tracker"
      description="Publish a public payout list — who's paid, what's pending, and the deadline. Self-reported by you, visible to everyone."
      successMessage="Free plan active. Create your first payout tracker."
      orgSlug={orgSlug}
      claimAction={claimFreePayoutTrackerAction}
    />
  );
}
