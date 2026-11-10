import type { SplitResult, PrizePublishContext } from "../types";

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(result: SplitResult, ctx?: PrizePublishContext): string {
  const lines: string[] = [];

  // Metadata header
  if (ctx?.tournamentName?.trim()) lines.push(`Tournament,${csvEscape(ctx.tournamentName.trim())}`);
  if (ctx?.date?.trim()) lines.push(`Date,${csvEscape(ctx.date.trim())}`);
  if (ctx?.sponsorName?.trim()) lines.push(`Sponsor,${csvEscape(ctx.sponsorName.trim())}`);
  lines.push(`Prize Pool,${result.prizePool}`);
  lines.push(`Currency,${result.currency}`);
  lines.push(`Total Distributed,${result.totalDistributed}`);
  lines.push(`Total Percentage,${result.totalPercentage}`);
  if (result.remainingMinor !== 0) lines.push(`Remaining,${result.remaining}`);
  lines.push("");

  // Table
  lines.push("Position,Label,Percentage,Payout,PayoutMinor");
  for (const p of result.placements) {
    lines.push([p.position, csvEscape(p.label), p.percentage, p.payout, p.payoutMinor].join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
