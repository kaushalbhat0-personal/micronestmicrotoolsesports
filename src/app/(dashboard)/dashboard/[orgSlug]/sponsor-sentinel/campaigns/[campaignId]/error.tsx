"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function CampaignError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isNotFound = error.message.includes("Not found") || error.message.includes("Campaign not found");
  const isProofLocked = error.message.includes("existing proof");
  const isLastRequirement = error.message.includes("last requirement");
  const title = isNotFound ? "Campaign not found" : isProofLocked || isLastRequirement ? "Can't remove requirement" : "Something went wrong";
  return (
    <div className="py-8">
      <ErrorState title={title} message={error.message || "An unexpected error occurred."} retry={reset} />
    </div>
  );
}
