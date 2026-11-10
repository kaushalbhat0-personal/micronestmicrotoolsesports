"use client";

import * as React from "react";
import { ToolClaimCard } from "@/components/freemium/tool-claim-card";
import { claimFreePrizeSplitterAction } from "../actions/claim-actions";

/**
 * Free claim affordance for the Prize Pool Splitter denied surface.
 * Thin binder: canonical badge + allowance render via `ToolClaimCard`;
 * issuance stays in the generic claim dispatch (server-side).
 */
export function ClaimFreePrizeSplitterCard({ orgSlug }: { orgSlug: string }) {
  return (
    <ToolClaimCard
      toolSlug="prize-splitter"
      toolName="Prize Pool Splitter"
      description="Split a prize pool in seconds — deterministic payouts, reconciled to the last cent."
      successMessage="You're all set — unlimited calculations, sharing, and CSV export."
      orgSlug={orgSlug}
      claimAction={claimFreePrizeSplitterAction}
    />
  );
}
