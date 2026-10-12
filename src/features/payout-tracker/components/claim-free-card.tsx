"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClaimCard, type ClaimStatus } from "@/components/freemium/claim-card";
import { claimFreePayoutTrackerAction } from "../actions/claim-actions";

/**
 * Free claim affordance for the Prize Payout Tracker denied surface.
 * Presentational wrapper: the generic claim dispatch stays authoritative
 * (membership, policy gates, org-scoped issuance all server-side).
 */
export function ClaimFreePayoutTrackerCard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ClaimStatus>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function onClaim() {
    setStatus("loading");
    setError(undefined);
    try {
      const res = await claimFreePayoutTrackerAction(orgSlug);
      if (res?.error) {
        setError(res.error);
        setStatus("error");
        return;
      }
      setStatus("success");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <ClaimCard
      toolName="Prize Payout Tracker"
      description="Publish a public payout list — who's paid, what's pending, and the deadline. Self-reported by you, visible to everyone."
      limits="Free plan: 1 published tracker per month · up to 20 recipients per tracker · unlimited drafts."
      claimLabel="Start free"
      status={status}
      error={error}
      successMessage="Free plan active. Create your first payout tracker."
      onClaim={onClaim}
    />
  );
}
