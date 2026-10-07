import type { TieBreakerShareRecord } from "./share";

/**
 * Tie-Breaker Resolver — Official result text builder (copy/share/print).
 * Pure function. Public projection only: no notes, no internal identifiers.
 */

export function buildTieBreakerCopyText(record: TieBreakerShareRecord, publicUrl: string): string {
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
