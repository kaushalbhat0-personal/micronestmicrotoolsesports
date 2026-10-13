"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClaimCard, type ClaimStatus } from "./claim-card";
import { freeBadgeBySlug, freeTierBySlug } from "@/config/marketing/free-tiers";

/**
 * ToolClaimCard — canonical Free-claim affordance for tool denied surfaces.
 *
 * Single source for Free-claim presentation: the badge ("Free forever" for
 * unlimited tools, "Free plan" for quota-limited tools) and the allowance
 * line both derive from the canonical Free-tier registry
 * (`src/config/marketing/free-tiers.ts`), so claim copy cannot drift from
 * the enforced limits or from marketing/billing surfaces. Callers supply
 * only the tool identity, bespoke description, success message, and the
 * server-bound claim action — issuance stays server-side.
 */
export function ToolClaimCard({
  toolSlug,
  toolName,
  description,
  successMessage,
  claimLabel = "Start free",
  orgSlug,
  claimAction,
}: {
  /** Canonical internal tool slug (matches the Free-policy registry). */
  toolSlug: string;
  /** Customer-facing tool name. */
  toolName: string;
  /** Bespoke supporting copy (must not restate the badge or allowance). */
  description: string;
  /** Confirmation text shown after a successful claim. */
  successMessage: string;
  claimLabel?: string | undefined;
  orgSlug: string;
  claimAction: (orgSlug: string) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<ClaimStatus>("idle");
  const [error, setError] = React.useState<string | undefined>(undefined);

  const tier = freeTierBySlug(toolSlug);
  const badge = freeBadgeBySlug(toolSlug) ?? "Free plan";
  const limits = tier ? `${badge}: ${tier.details}` : undefined;

  async function onClaim() {
    setStatus("loading");
    setError(undefined);
    try {
      const res = await claimAction(orgSlug);
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
      toolName={toolName}
      description={description}
      limits={limits}
      badge={badge}
      claimLabel={claimLabel}
      status={status}
      error={error}
      successMessage={successMessage}
      onClaim={onClaim}
    />
  );
}
