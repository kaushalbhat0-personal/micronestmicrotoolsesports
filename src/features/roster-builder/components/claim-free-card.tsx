"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClaimCard, type ClaimStatus } from "@/components/freemium/claim-card";
import { claimFreeRosterBuilderAction } from "../actions/claim-actions";

/**
 * Free claim affordance for the Roster Builder denied surface.
 * Presentational wrapper: the generic claim dispatch stays authoritative
 * (membership, policy gates, org-scoped issuance all server-side).
 * Free is unlimited (rosters, slots, copies, CSV) — stated descriptively;
 * no quota counting here.
 */
export function ClaimFreeRosterBuilderCard({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ClaimStatus>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);

  async function onClaim() {
    setStatus("loading");
    setError(undefined);
    try {
      const res = await claimFreeRosterBuilderAction(orgSlug);
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
      toolName="Tournament Roster & Slot Builder"
      description="Paste messy registrations, catch duplicate players and multi-team conflicts, assign slots, and copy a clean roster. Free forever."
      limits="Free plan: unlimited rosters, slot lists, copies, and CSV export."
      claimLabel="Start free"
      status={status}
      error={error}
      successMessage="Free plan active. Unlimited rosters, slots, copies, and CSV export."
      onClaim={onClaim}
    />
  );
}
