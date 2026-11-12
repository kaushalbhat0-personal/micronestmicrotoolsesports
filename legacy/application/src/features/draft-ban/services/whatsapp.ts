import { appendPublicUrl, WHATSAPP_PREFILL_BUDGET } from "@/lib/share/whatsapp";

/**
 * Draft & Ban — WhatsApp message composer for completed/public records.
 *
 * Mirrors the official copy format (same headers, same history/picks
 * wording) without touching internal notes — callers never pass them.
 * Long action histories collapse to the first `maxHistoryActions` entries
 * with an explicit marker; final selections, remaining pool/decider, and
 * the public URL are always preserved.
 */

export interface DraftWhatsAppAction {
  readonly team: "A" | "B";
  readonly type: string;
  readonly item: string;
}

export interface DraftWhatsAppInput {
  readonly teamA: string;
  readonly teamB: string;
  readonly eventName?: string | null | undefined;
  readonly matchName?: string | null | undefined;
  readonly formatLabel?: string | null | undefined;
  readonly refCode: string;
  readonly organizationName: string;
  readonly completedAt?: string | null | undefined;
  readonly actions: ReadonlyArray<DraftWhatsAppAction>;
  readonly remaining: ReadonlyArray<string>;
  readonly publicUrl?: string | null | undefined;
  readonly maxHistoryActions?: number | undefined;
  readonly maxChars?: number | undefined;
}

function verb(type: string): string {
  return type === "ban" ? "Ban" : type === "pick" ? "Pick" : "Side";
}

export function buildDraftWhatsAppMessage(input: DraftWhatsAppInput): string {
  const maxChars = input.maxChars ?? WHATSAPP_PREFILL_BUDGET;
  let historyBudget = Math.max(0, input.maxHistoryActions ?? 20);
  // Shrink only the history window until the message (selections + URL
  // always intact) fits — the public URL is never cut.
  for (;;) {
    const message = assemble({ ...input, maxHistoryActions: historyBudget });
    if (message.length <= maxChars || historyBudget === 0) return message;
    historyBudget = Math.floor(historyBudget / 2);
  }
}

function assemble(input: DraftWhatsAppInput & { maxHistoryActions: number }): string {
  const teamName = (team: "A" | "B") => (team === "A" ? input.teamA : input.teamB);
  const lines: string[] = [];
  lines.push("MICRONEST — MATCH DRAFT RECORD");
  lines.push(`${input.teamA} vs ${input.teamB}`);
  if (input.eventName) lines.push(`Event: ${input.eventName}`);
  if (input.matchName) lines.push(`Match: ${input.matchName}`);
  if (input.formatLabel) lines.push(`Format: ${input.formatLabel}`);
  lines.push(`Record no.: ${input.refCode}`);
  lines.push(`Workspace: ${input.organizationName}`);
  if (input.completedAt) lines.push(`Completed: ${input.completedAt}`);
  lines.push("");
  lines.push("ACTION HISTORY");
  const shown = input.actions.slice(0, input.maxHistoryActions);
  shown.forEach((a, i) => {
    lines.push(`${i + 1}. ${teamName(a.team)} — ${verb(a.type)} — ${a.item}`);
  });
  const omitted = input.actions.length - shown.length;
  if (omitted > 0) lines.push(`…and ${omitted} more action${omitted === 1 ? "" : "s"} (full record at the link).`);
  lines.push("");
  lines.push("FINAL SELECTIONS");
  for (const a of input.actions.filter((x) => x.type === "pick")) {
    lines.push(`${a.item} — ${teamName(a.team)} pick`);
  }
  if (input.remaining.length > 0) {
    lines.push("");
    lines.push(`REMAINING POOL: ${input.remaining.join(", ")}`);
    if (input.remaining.length === 1) lines.push(`DECIDER: ${input.remaining[0]}`);
  }
  const body = lines.join("\n");
  return input.publicUrl ? appendPublicUrl(body, input.publicUrl) : body;
}
