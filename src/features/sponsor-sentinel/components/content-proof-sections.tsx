"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { groupProofByContent } from "@/features/sponsor-sentinel/services/proof-grouping";
import type { Evidence, Evaluation } from "@/types/database";
import { formatDateTimeKolkata } from "@/lib/utils/format";

function platformLabel(platform: string): string {
  if (platform === "youtube") return "YouTube";
  if (platform === "twitch") return "Twitch";
  if (platform === "kick") return "Kick";
  return platform;
}

/**
 * Content-centric proof rendering.
 * One card per external_content_id (plus scan boundary), with all requirements underneath.
 * Preserves platform badge per content and deduplicates source URL to one link.
 */
export function ContentProofSections({
  evidence,
  evaluations,
  deliverableMap,
  emptyTitle = "No proof yet",
  emptyDescription = "No proof was found for this check. This may be a failed or pending check.",
}: {
  evidence: readonly Evidence[];
  evaluations: readonly Evaluation[];
  deliverableMap: ReadonlyMap<string, { name: string; rule: unknown }>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (evidence.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const groups = groupProofByContent(evidence, evaluations, deliverableMap);
  if (groups.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-3" aria-label="Proof by content">
      {groups.map((group) => (
        <div
          key={`${group.scanId ?? "no-scan"}::${group.contentId}`}
          className="rounded-lg border bg-card p-4"
          aria-label={`${platformLabel(group.platform)} content ${group.contentId} with ${group.requirements.length} requirements`}
        >
          {/* Content header */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {platformLabel(group.platform)}
                </Badge>
                {group.channelId ? (
                  <span className="text-xs text-muted-foreground truncate max-w-[12rem]" title={group.channelId}>
                    {group.channelId}
                  </span>
                ) : null}
                {group.observedAt ? (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeKolkata(group.observedAt)}</span>
                ) : null}
              </div>
              {/* Title — long titles must not break layout */}
              {group.title ? (
                <p className="text-sm font-medium break-words line-clamp-3 max-w-[36rem]" title={group.title}>
                  {group.title}
                </p>
              ) : (
                <p className="text-sm font-medium text-muted-foreground break-words">Content {group.contentId.slice(0, 8)}</p>
              )}
            </div>
            {/* Source link — deduplicated to one per content group */}
            {group.sourceUrl ? (
              <a
                href={group.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 text-xs text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm px-1 py-0.5"
                aria-label={`View source for ${group.title ?? group.contentId}`}
              >
                View source
              </a>
            ) : null}
          </div>

          {/* Requirements for this content */}
          <ul className="mt-3 space-y-2" aria-label={`Requirements for ${group.title ?? group.contentId}`}>
            {group.requirements.map((req) => (
              <li
                key={`${req.evidenceId}::${req.deliverableId}`}
                className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2"
              >
                <StatusBadge status={req.result} />
                <span className="text-sm break-words flex-1 min-w-[10rem]" title={req.requirementName}>
                  {req.requirementName}
                </span>
                {/* Result reason — truncated but accessible via title */}
                {req.reason ? (
                  <span className="text-xs text-muted-foreground max-w-[14rem] truncate" title={req.reason}>
                    {req.reason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          {/* Multiple source URLs if they differ (rare) — deduplicated display */}
          {group.sourceUrls.length > 1 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {group.sourceUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate max-w-[16rem]" title={url}>
                  {url}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
