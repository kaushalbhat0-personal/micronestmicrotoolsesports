"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyCompetitionAction } from "../actions/competition-actions";

/** Starts a new draft with the same teams and rules. Results are never copied. */
export function CopyCompetitionButton({ orgSlug, competitionId }: { orgSlug: string; competitionId: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [copying, setCopying] = React.useState(false);

  async function onCopy() {
    setError(null);
    setCopying(true);
    try {
      const result = await copyCompetitionAction({ orgSlug, competitionId });
      if (result.error || !result.competitionId) {
        setError(result.error ?? "Could not create the copy. Please try again.");
        return;
      }
      router.push(`/dashboard/${orgSlug}/tie-breaker/${result.competitionId}` as Route);
      router.refresh();
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="outline" loading={copying} className="min-h-[44px]" onClick={onCopy}>
        <Copy className="h-4 w-4" aria-hidden /> Copy for next competition
      </Button>
      {error && (
        <p role="alert" className="mt-2 rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
