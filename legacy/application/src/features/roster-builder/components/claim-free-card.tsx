"use client";

import * as React from "react";
import { ToolClaimCard } from "@/components/freemium/tool-claim-card";
import { claimFreeRosterBuilderAction } from "../actions/claim-actions";

/**
 * Free claim affordance for the Roster Builder denied surface.
 * Thin binder: canonical badge + allowance render via `ToolClaimCard`;
 * issuance stays in the generic claim dispatch (server-side).
 */
export function ClaimFreeRosterBuilderCard({ orgSlug }: { orgSlug: string }) {
  return (
    <ToolClaimCard
      toolSlug="roster-builder"
      toolName="Tournament Roster & Slot Builder"
      description="Paste messy registrations, catch duplicate players and multi-team conflicts, assign slots, and copy a clean roster."
      successMessage="You're all set — unlimited rosters, slots, copies, and CSV export."
      orgSlug={orgSlug}
      claimAction={claimFreeRosterBuilderAction}
    />
  );
}
