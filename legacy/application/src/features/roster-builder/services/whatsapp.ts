import type { WorkingTeam } from "../types";
import { buildCopyText } from "./output";
import { WHATSAPP_PREFILL_BUDGET } from "@/lib/share/whatsapp";

/**
 * Tournament Roster & Slot Builder — WhatsApp message composer.
 *
 * Text-only: there is deliberately no public share URL, and none is
 * invented here. Reuses the WhatsApp/Discord-safe copy text (contacts and
 * third-column values are excluded upstream and never touched here).
 * Optional caller-supplied header lines (tournament/event name, date,
 * short note) precede the roster. Long rosters are bounded team-wise with
 * an explicit "full list in CSV/print" marker; the unresolved-issues
 * warning banner is always preserved.
 */
export interface RosterWhatsAppOptions {
  readonly headerLines?: ReadonlyArray<string> | undefined;
  readonly unresolvedCount?: number | undefined;
  readonly maxChars?: number | undefined;
}

export function buildRosterWhatsAppMessage(
  teams: ReadonlyArray<WorkingTeam>,
  opts?: RosterWhatsAppOptions | undefined,
): string {
  const maxChars = opts?.maxChars ?? WHATSAPP_PREFILL_BUDGET;
  const header = (opts?.headerLines ?? []).map((line) => line.trim()).filter((line) => line.length > 0);
  const headerBlock = header.length > 0 ? `${header.join("\n")}\n\n` : "";
  const marker = "… (more teams — full list in CSV/print).";
  // Grow team-by-team so the message stays bounded and explicit.
  const kept: WorkingTeam[] = [];
  for (const team of teams) {
    const candidate = buildCopyText([...kept, team], { unresolvedCount: opts?.unresolvedCount });
    const withMarker = kept.length + 1 < teams.length ? `${candidate}\n${marker}` : candidate;
    if (headerBlock.length + withMarker.length > maxChars) break;
    kept.push(team);
  }
  const body =
    kept.length === teams.length
      ? buildCopyText(teams, { unresolvedCount: opts?.unresolvedCount })
      : `${buildCopyText(kept, { unresolvedCount: opts?.unresolvedCount })}\n${marker}`;
  return `${headerBlock}${body}`;
}
