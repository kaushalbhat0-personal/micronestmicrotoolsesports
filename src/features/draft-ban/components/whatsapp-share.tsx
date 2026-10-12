"use client";

import * as React from "react";
import { WhatsAppShare } from "@/components/shared/whatsapp-share";
import { buildDraftWhatsAppMessage } from "../services/whatsapp";
import type { DraftMatch } from "@/types/database";

/**
 * Draft & Ban — WhatsApp sharing for completed/public records.
 * Rendered only for completed matches (callers gate on status). The
 * message mirrors the official copy format from the actual match data —
 * internal notes are never passed in — plus the existing public share
 * URL. The official record is never modified.
 */
export function DraftWhatsAppShare({
  match,
  organizationName,
  shareUrl,
}: {
  match: DraftMatch;
  organizationName: string;
  /** Relative public path, e.g. `/share/draft-ban/<token>`. */
  shareUrl: string | null | undefined;
}) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!origin || !shareUrl) return null;
  const consuming = match.actions.filter((a) => a.type === "ban" || a.type === "pick");
  const remaining = match.pool.filter((p) => !consuming.some((a) => a.item.toLowerCase() === p.toLowerCase()));
  const message = buildDraftWhatsAppMessage({
    teamA: match.team_a,
    teamB: match.team_b,
    eventName: match.event_name,
    matchName: match.match_name,
    formatLabel: match.format_label,
    refCode: match.ref_code,
    organizationName,
    completedAt: match.completed_at ? new Date(match.completed_at).toLocaleString("en-GB") : null,
    actions: match.actions.map((a) => ({ team: a.team, type: a.type, item: a.item })),
    remaining,
    publicUrl: `${origin}${shareUrl}`,
  });
  return (
    <WhatsAppShare
      message={message}
      reviewNote="Official completed record — the result itself cannot change. You are only editing the message you're about to send."
    />
  );
}
