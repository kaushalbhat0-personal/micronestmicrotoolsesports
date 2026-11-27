import type { TieBreakerCopyRecord } from "./share-text";
import { buildTieBreakerCopyText } from "./share-text";
import { WHATSAPP_PREFILL_BUDGET } from "@/lib/share/whatsapp";

/**
 * Tie-Breaker Resolver — WhatsApp message composer.
 *
 * Only ever called with a locked/official record plus its existing public
 * token URL (callers must not invoke it for drafts — no public result
 * exists there). Reuses the official copy builder verbatim, then bounds
 * the explanatory section: standings are the essential result and are
 * never cut; explanations beyond `maxExplanations` collapse into an
 * explicit marker. The public URL line always survives.
 */
export function buildTieBreakerWhatsAppMessage(
  record: TieBreakerCopyRecord,
  publicUrl: string,
  opts?: { maxExplanations?: number | undefined; maxChars?: number | undefined },
): string {
  const maxExplanations = opts?.maxExplanations ?? 3;
  const maxChars = opts?.maxChars ?? WHATSAPP_PREFILL_BUDGET;
  const full = buildTieBreakerCopyText(record, publicUrl);
  const lines = full.split("\n");
  const whyIndex = lines.findIndex((line) => line === "WHY EACH TEAM PLACED HERE");
  if (whyIndex < 0) return boundLength(lines, maxChars);
  const explanations = lines.slice(whyIndex + 1).filter((line) => line.startsWith("- "));
  const tail = lines.slice(whyIndex + 1 + explanations.length);
  const kept = explanations.slice(0, Math.max(0, maxExplanations));
  const omitted = explanations.length - kept.length;
  const body = [
    ...lines.slice(0, whyIndex + 1),
    ...kept,
    ...(omitted > 0 ? [`- … (${omitted} more reason${omitted === 1 ? "" : "s"} — full record at the link).`] : []),
    ...tail,
  ];
  return boundLength(body, maxChars);
}

function boundLength(lines: string[], maxChars: number): string {
  const joined = lines.join("\n");
  if (joined.length <= maxChars) return joined;
  // Last resort: drop the explanation block entirely (explicit marker),
  // preserving standings head and the locked/URL tail.
  const whyIndex = lines.findIndex((line) => line === "WHY EACH TEAM PLACED HERE");
  if (whyIndex < 0) return joined.slice(0, maxChars);
  const tail = lines.slice(whyIndex).filter((line) => !line.startsWith("- ") && line !== "WHY EACH TEAM PLACED HERE");
  const shortened = [...lines.slice(0, whyIndex), "- Full reasons in the linked record.", ...tail].join("\n");
  return shortened.length <= maxChars ? shortened : shortened.slice(0, maxChars);
}
