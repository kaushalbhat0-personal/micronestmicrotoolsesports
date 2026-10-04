"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { groupProofByContent } from "@/features/sponsor-sentinel/services/proof-grouping";
import type { Evidence, Evaluation } from "@/types/database";
import { formatDateTimeKolkata } from "@/lib/utils/format";
import { Video } from "lucide-react";

function youtubeThumb(contentId: string | null, platform: string): string | null {
  if (platform !== "youtube" || !contentId) return null;
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(contentId)) return null;
  return `https://i.ytimg.com/vi/${contentId}/hqdefault.jpg`;
}

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
      {groups.map((group) => {
        const thumb = youtubeThumb(group.contentId, group.platform);
        return (
          <div
            key={`${group.scanId ?? "no-scan"}::${group.contentId}`}
            className="rounded-[16px] border border-border bg-card p-4"
            aria-label={`${platformLabel(group.platform)} content ${group.contentId} with ${group.requirements.length} requirements`}
          >
            {/* Content header with thumbnail */}
            <div className="flex gap-3">
              <div className="hidden h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[8px] border border-border bg-surface-muted sm:flex items-center justify-center">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Video className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={group.platform === "youtube" ? "platform-youtube" : group.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[10px]">
                    {platformLabel(group.platform)}
                  </Badge>
                  {group.channelId ? (
                    <span className="text-xs text-muted-foreground truncate max-w-[12rem]" title={group.channelId}>
                      {group.channelId}
                    </span>
                  ) : null}
                  {group.observedAt ? <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeKolkata(group.observedAt)}</span> : null}
                </div>
                {group.title ? (
                  <p className="text-sm font-medium break-words line-clamp-2 max-w-[36rem]" title={group.title}>
                    {group.title}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground break-words">Content {group.contentId.slice(0, 8)}</p>
                )}
                {group.sourceUrl ? (
                  <a href={group.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex text-xs font-medium text-primary hover:underline" aria-label={`View source for ${group.title ?? group.contentId}`}>
                    View source
                  </a>
                ) : null}
              </div>
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
        );
      })}
    </div>
  );
}
