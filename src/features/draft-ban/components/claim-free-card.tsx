"use client";

import * as React from "react";
import { ToolClaimCard } from "@/components/freemium/tool-claim-card";
import { claimFreeDraftBanAction } from "../actions/match-actions";

/**
 * Free claim affordance for the Draft & Ban denied surface.
 * Thin binder: canonical badge + allowance render via `ToolClaimCard`;
 * issuance stays in the generic claim dispatch (server-side).
 */
export function ClaimFreeDraftBanCard({ orgSlug }: { orgSlug: string }) {
  return (
    <ToolClaimCard
      toolSlug="draft-ban"
      toolName="Draft & Ban"
      description="Run match drafts and lock shareable official records."
      successMessage="Free plan active. You can now lock 1 official match this month."
      orgSlug={orgSlug}
      claimAction={claimFreeDraftBanAction}
    />
  );
}
