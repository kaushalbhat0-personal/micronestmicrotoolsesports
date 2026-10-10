"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClaimCard, type ClaimStatus } from "@/components/freemium/claim-card";
import { claimFreePrizeSplitterAction } from "../actions/claim-actions";

/**
 * Free claim affordance for the Prize Pool Splitter denied surface.
 * Presentational wrapper: the generic claim dispatch stays authoritative
 * (membership, policy gates, org-scoped issuance all server-side).
 * Free is unlimited (calculations, shares, CSV) — stated descriptively;
 * no quota counting here.
 */
export function ClaimFreePrizeSplitterCard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ClaimStatus>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function onClaim() {
    setStatus("loading");
    setError(undefined);
    try {
      const res = await claimFreePrizeSplitterAction(orgSlug);
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
      toolName="Prize Pool Splitter"
      description="Split a prize pool in seconds — deterministic payouts, reconciled to the last cent. Free forever."
      limits="Free plan: unlimited calculations, share links, and CSV export."
      claimLabel="Start free"
      status={status}
      error={error}
      successMessage="Free plan active. Unlimited calculations, sharing, and CSV export."
      onClaim={onClaim}
    />
  );
}
