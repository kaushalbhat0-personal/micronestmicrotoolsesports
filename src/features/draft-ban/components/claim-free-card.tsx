"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClaimCard, type ClaimStatus } from "@/components/freemium/claim-card";
import { claimFreeDraftBanAction } from "../actions/match-actions";

/**
 * Free claim affordance for the Draft & Ban denied surface.
 * Presentational wrapper: the generic claim dispatch stays authoritative
 * (membership, policy gates, org-scoped issuance all server-side).
 * States the Free-forever limits descriptively; no quota counting here.
 */
export function ClaimFreeDraftBanCard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ClaimStatus>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function onClaim() {
    setStatus("loading");
    setError(undefined);
    try {
      const res = await claimFreeDraftBanAction(orgSlug);
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
      toolName="Draft & Ban"
      description="Run match drafts and lock shareable official records. Free forever."
      limits="Free plan: 1 official match this month, 3 custom templates, latest 5 records visible. Drafts unlimited."
      claimLabel="Start free"
      status={status}
      error={error}
      successMessage="Free plan active. You can now lock 1 official match this month."
      onClaim={onClaim}
    />
  );
}
