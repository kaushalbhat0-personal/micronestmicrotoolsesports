import type { DraftState } from "../types";
import { deriveView } from "./draft-engine";

/**
 * Draft & Ban — Official result text builder (copy/share).
 * Pure function. Mirrors prize-splitter formatters precedent.
 */

export interface DraftResultContext {
  readonly organizationName: string;
  readonly refCode: string;
  readonly matchName: string | null;
  readonly eventName: string | null;
  readonly formatLabel: string | null;
  readonly completedAt: string | null;
}

export function buildDraftCopyText(state: DraftState, ctx: DraftResultContext): string {
  const view = deriveView(state);
  const lines: string[] = [];
  lines.push("MICRONEST — MATCH DRAFT RECORD");
  lines.push(`${state.config.teamA} vs ${state.config.teamB}`);
  if (ctx.eventName) lines.push(`Event: ${ctx.eventName}`);
  if (ctx.matchName) lines.push(`Match: ${ctx.matchName}`);
  if (ctx.formatLabel) lines.push(`Format: ${ctx.formatLabel}`);
  lines.push(`Record no.: ${ctx.refCode}`);
  lines.push(`Workspace: ${ctx.organizationName}`);
  if (ctx.completedAt) lines.push(`Completed: ${ctx.completedAt}`);
  lines.push("");
  lines.push("ACTION HISTORY");
  state.actions.forEach((a, i) => {
    const teamName = a.team === "A" ? state.config.teamA : state.config.teamB;
    lines.push(`${i + 1}. ${teamName} — ${a.type === "ban" ? "Ban" : "Pick"} — ${a.item}`);
  });
  lines.push("");
  lines.push("FINAL SELECTIONS");
  for (const a of state.actions.filter((x) => x.type === "pick")) {
    const teamName = a.team === "A" ? state.config.teamA : state.config.teamB;
    lines.push(`${a.item} — ${teamName} pick`);
  }
  const remaining = view.available.filter((p) => p.status === "available").map((p) => p.name);
  if (remaining.length > 0) {
    lines.push("");
    lines.push(`REMAINING POOL: ${remaining.join(", ")}`);
    if (remaining.length === 1) lines.push(`DECIDER: ${remaining[0]}`);
  }
  return lines.join("\n");
}
