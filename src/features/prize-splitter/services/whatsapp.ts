import type { PrizePublishContext, SplitResult } from "../types";
import { formatPayoutAnnouncement } from "./formatters";
import { appendPublicUrl, WHATSAPP_PREFILL_BUDGET } from "@/lib/share/whatsapp";

/**
 * Prize Pool Splitter — WhatsApp message composer.
 *
 * Reuses the existing `whatsapp` announcement style (restrained emoji, no
 * code fences) plus the existing public share URL. Pure: no network, no
 * storage. Never invents values — placements, totals, and the URL come
 * from the actual result.
 *
 * Long placement lists are bounded with an explicit marker; the totals
 * and the share URL are always preserved.
 */
export function buildSplitterWhatsAppMessage(
  result: SplitResult,
  ctx: PrizePublishContext | undefined,
  shareUrl: string,
  maxChars: number = WHATSAPP_PREFILL_BUDGET,
): string {
  const full = formatPayoutAnnouncement(result, ctx, "whatsapp");
  const withUrl = appendPublicUrl(full, shareUrl);
  if (withUrl.length <= maxChars) return withUrl;

  // Bounded fallback: header + first placements that fit + explicit
  // marker + truthful full-result totals + URL. Never silently complete.
  const lines = full.split("\n");
  const totalsIndex = lines.findIndex((line) => line.startsWith("Total Distributed:"));
  const poolIndex = lines.findIndex((line) => line.startsWith("Prize Pool:"));
  const bodyEnd = totalsIndex >= 0 ? totalsIndex : lines.length;
  const placementsStart = poolIndex >= 0 ? poolIndex + 2 : 0;
  const prefixLines = lines.slice(0, Math.min(placementsStart, bodyEnd));
  const placementLines = lines.slice(Math.min(placementsStart, bodyEnd), bodyEnd);
  const totals = totalsIndex >= 0 ? lines.slice(totalsIndex) : [];
  const urlBlock = `\n\nView online: ${shareUrl}`;
  const reserve = urlBlock.length + 60 + totals.join("\n").length;
  const budget = Math.max(0, maxChars - reserve - prefixLines.join("\n").length);
  const kept: string[] = [];
  let used = 0;
  for (const line of placementLines) {
    if (used + line.length + 1 > budget) break;
    kept.push(line);
    used += line.length + 1;
  }
  const omitted = placementLines.length - kept.length;
  const marker = `…and ${omitted} more placement${omitted === 1 ? "" : "s"} (full split at the link).`;
  return [...prefixLines, ...kept, marker, ...totals].join("\n") + urlBlock;
}
