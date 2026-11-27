import {
  computeStandings,
  type TiebreakScenario,
} from "@/features/tools/tiebreak/engine";
import type { ShareCardSpec } from "@/lib/share-kit";

export function buildTiebreakShareSpec(
  scenario: TiebreakScenario,
  destinationLabel: string,
): ShareCardSpec {
  const standings = computeStandings(scenario);
  const blocks = standings.standings.slice(0, 10).map((entry) => {
    const tag =
      entry.qualification === "qualified"
        ? "Q"
        : entry.qualification === "contested"
          ? "C"
          : entry.qualification === "out"
            ? "—"
            : "";
    return `#${entry.rank} ${entry.displayName}  ${entry.total}${tag ? ` [${tag}]` : ""}`;
  });
  if (standings.standings.length > 10) {
    blocks.push(`+${standings.standings.length - 10} more teams`);
  }

  const rows = [
    { label: "Scenario", value: scenario.name?.trim() || "Untitled scenario" },
    {
      label: "Cutoff",
      value: scenario.cutoff === 0 ? "None" : `Top ${scenario.cutoff}`,
    },
    { label: "Teams", value: String(scenario.teams.length) },
  ];
  if (standings.cutoffContested) {
    rows.push({ label: "Note", value: "Contested places at the cutoff" });
  }

  return {
    tone: "tool",
    eyebrow: "Tie-Break Simulator",
    title: scenario.name?.trim() || "Standings simulation",
    subtitle: "User-generated ranking — not an official tournament result",
    rows,
    blocks,
    disclaimer:
      "Simulated with FRAGIX Tie-Break. Missing scores are treated as zero when disclosed in the tool. Not an official PMGC or tournament result.",
    destinationLabel,
    filenameBase: `tiebreak-${scenario.name ?? "standings"}`,
  };
}
