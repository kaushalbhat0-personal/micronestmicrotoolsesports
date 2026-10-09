"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClaimCard, type ClaimStatus } from "@/components/freemium/claim-card";
import { claimFreeTieBreakerAction } from "../actions/competition-actions";

/**
 * Free claim affordance for the Tie-Breaker denied surface.
 * Presentational wrapper: the generic claim dispatch stays authoritative
 * (membership, policy gates, org-scoped issuance all server-side).
 */
export function ClaimFreeTieBreakerCard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ClaimStatus>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function onClaim() {
    setStatus("loading");
    setError(undefined);
    try {
      const res = await claimFreeTieBreakerAction(orgSlug);
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
      toolName="Tie-Breaker Resolver"
      description="Settle tied standings and lock shareable official records."
      limits="Free plan: 3 official records this month. Drafts unlimited."
      claimLabel="Start free"
      status={status}
      error={error}
      successMessage="Free plan active. You can now lock up to 3 official records this month."
      onClaim={onClaim}
    />
  );
}
