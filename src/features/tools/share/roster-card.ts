import {
  describeCompleteness,
  occupantAt,
  playerLine,
  type RosterState,
} from "@/features/tools/roster/roster";
import type { ShareCardSpec } from "@/lib/share-kit";

export function buildRosterShareSpec(state: RosterState, destinationLabel: string): ShareCardSpec {
  const completeness = describeCompleteness(state);
  const statusLabel =
    completeness.status === "complete"
      ? "Complete"
      : completeness.status === "empty"
        ? "Empty"
        : "Partial";

  const blocks: string[] = [];
  for (let index = 0; index < state.config.starterSlots; index += 1) {
    const occupant = occupantAt(state, { kind: "starter", index });
    blocks.push(`S${index + 1}: ${occupant ? playerLine(occupant) : "<empty>"}`);
  }
  for (let index = 0; index < state.config.substituteSlots; index += 1) {
    const occupant = occupantAt(state, { kind: "substitute", index });
    blocks.push(`Sub ${index + 1}: ${occupant ? playerLine(occupant) : "<empty>"}`);
  }
  const bench = state.players.filter((player) => player.assignment === null);
  if (bench.length > 0) {
    blocks.push(`Bench: ${bench.map((player) => playerLine(player)).join(", ")}`);
  }
  const capped = blocks.slice(0, 10);
  if (blocks.length > 10) {
    capped.push(`+${blocks.length - 10} more lines`);
  }
  const assignedCount = state.players.filter((player) => player.assignment !== null).length;

  return {
    tone: "tool",
    eyebrow: "Roster & Slot Builder",
    title: state.config.teamName?.trim() || "Unnamed team",
    subtitle: `BGMI · ${state.config.starterSlots} starters + ${state.config.substituteSlots} subs · ${statusLabel}`,
    rows: [
      { label: "Status", value: statusLabel },
      {
        label: "Players",
        value: `${state.players.length} (${assignedCount} assigned · ${bench.length} bench)`,
      },
    ],
    blocks: capped,
    disclaimer:
      "User-created roster plan — not an official entry or verification. Generated with FRAGIX tools.",
    destinationLabel,
    filenameBase: `roster-${state.config.teamName ?? "plan"}`,
  };
}

/** CSV for the tools roster model (separate from D1 WorkingTeam helpers). */
export function buildToolsRosterCsv(state: RosterState): string {
  const lines = ["Kind,Slot,DisplayName,PlayerId,Role,Notes"];
  for (const player of state.players) {
    const kind = player.assignment?.kind ?? "bench";
    const slot = player.assignment === null ? "" : String(player.assignment.index + 1);
    lines.push(
      [
        kind,
        slot,
        csvCell(player.displayName),
        csvCell(player.playerId ?? ""),
        csvCell(player.role ?? "Flexible"),
        csvCell(player.notes ?? ""),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string): string {
  const needsGuard = /^[=+\-@|\t]/.test(value);
  const guarded = needsGuard ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}
