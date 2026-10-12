/**
 * Tie-Breaker Resolver — Official result text builder (copy/share/print).
 * Pure function. Public projection only: no notes, no internal identifiers.
 */

/**
 * Minimal structural input for the official copy builder. Accepts the
 * locked share DTO and equivalent domain snapshots (readonly-friendly)
 * without conversion.
 */
export interface TieBreakerCopyRecord {
  readonly competition_name: string;
  readonly description: string | null;
  readonly record_number: string;
  readonly organization_name: string;
  readonly locked_at: string;
  readonly snapshot: {
    readonly standings: ReadonlyArray<{
      readonly position: number;
      readonly teamId: string;
      readonly points: number;
      readonly wins: number;
      readonly tied: boolean;
    }>;
    readonly teamNames: Readonly<Record<string, string>>;
    readonly explanations: ReadonlyArray<{ readonly summary: string }>;
  };
}

export function buildTieBreakerCopyText(record: TieBreakerCopyRecord, publicUrl: string): string {
  const lines: string[] = [];
  lines.push("MICRONEST — OFFICIAL RESULT");
  lines.push(record.competition_name);
  if (record.description) lines.push(record.description);
  lines.push(`Record no.: ${record.record_number}`);
  lines.push(`Published by: ${record.organization_name}`);
  if (record.locked_at) lines.push(`Locked: ${record.locked_at}`);
  lines.push("");
  lines.push("FINAL STANDINGS");
  const standings = [...record.snapshot.standings].sort((a, b) => a.position - b.position);
  for (const entry of standings) {
    const name = record.snapshot.teamNames[entry.teamId] ?? "Team";
    const tied = entry.tied ? " (tied)" : "";
    lines.push(`${entry.position}. ${name}${tied} — ${entry.points} pts, ${entry.wins}W`);
  }
  const summaries = record.snapshot.explanations.map((e) => e.summary).filter((s) => s.length > 0);
  if (summaries.length > 0) {
    lines.push("");
    lines.push("WHY EACH TEAM PLACED HERE");
    for (const summary of summaries) lines.push(`- ${summary}`);
  }
  lines.push("");
  lines.push("This is a locked official result and cannot be changed.");
  if (publicUrl) lines.push(`View online: ${publicUrl}`);
  return lines.join("\n");
}
