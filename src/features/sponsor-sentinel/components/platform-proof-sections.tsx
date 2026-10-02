"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { groupEvidenceByPlatform } from "@/features/sponsor-sentinel/services/proof-grouping";
import type { Evidence } from "@/types/database";
import { formatDateTimeKolkata } from "@/lib/utils/format";

function platformLabel(platform: string): string {
  if (platform === "youtube") return "YouTube";
  if (platform === "twitch") return "Twitch";
  if (platform === "kick") return "Kick";
  return platform;
}

export function PlatformProofSections({
  evidence,
  deliverableMap,
  emptyTitle = "No proof yet",
  emptyDescription = "No proof was found for this check. This may be a failed or pending check.",
}: {
  evidence: readonly Evidence[];
  deliverableMap: ReadonlyMap<string, { name: string; rule: unknown }>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (evidence.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const groups = groupEvidenceByPlatform(evidence);
  if (groups.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      {groups.map(({ platform, items }, idx) => {
        const isFirst = idx === 0;
        // Default open: single platform → open, multi → first open
        const defaultOpen = groups.length === 1 || isFirst;
        return (
          <details
            key={platform}
            open={defaultOpen}
            className="group rounded-lg border bg-card"
            aria-label={`${platformLabel(platform)} Proofs (${items.length})`}
          >
            <summary
              className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-medium hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`${platformLabel(platform)} Proofs (${items.length})`}
            >
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {platformLabel(platform)}
                </Badge>
                <span>
                  {platformLabel(platform)} Proofs ({items.length})
                </span>
              </span>
              <span aria-hidden className="text-muted-foreground group-open:rotate-180 transition-transform">
                ▾
              </span>
            </summary>
            <div className="space-y-3 border-t p-4">
              {items.map((ev) => (
                <div key={ev.id} className="rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Requirement: <span className="font-medium text-foreground">{deliverableMap.get(ev.deliverable_id)?.name ?? "Requirement"}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="capitalize">
                        {platformLabel(ev.platform)}
                      </Badge>
                      <span className="text-muted-foreground">Source: {platformLabel(ev.platform)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Observed: {formatDateTimeKolkata(ev.observed_at)}
                    </p>
                    <p className="max-w-[36rem] break-words text-sm" title={ev.observed_value}>
                      {ev.observed_value}
                    </p>
                    {ev.source_url ? (
                      <a href={ev.source_url} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary underline">
                        View source
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
