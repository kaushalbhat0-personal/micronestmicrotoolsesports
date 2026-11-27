import type { SplitResult, PrizePublishContext } from "../types";
import { CURRENCY_LOCALES } from "../types";
import { formatMoney } from "./calculation";

export type AnnouncementStyle = "plain" | "discord" | "whatsapp" | "x";

function headerLines(ctx?: PrizePublishContext): string[] {
  const lines: string[] = [];
  if (ctx?.tournamentName?.trim()) lines.push(ctx.tournamentName.trim());
  if (ctx?.sponsorName?.trim()) lines.push(`Presented by ${ctx.sponsorName.trim()}`);
  if (ctx?.date?.trim()) {
    // Display date as-is; caller may pass ISO or formatted
    try {
      const d = new Date(ctx.date.trim());
      if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(ctx.date.trim())) {
        const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
        lines.push(fmt);
      } else {
        lines.push(ctx.date.trim());
      }
    } catch {
      lines.push(ctx.date.trim());
    }
  }
  return lines;
}

function localePool(result: SplitResult): string {
  const locale = CURRENCY_LOCALES[result.currency] ?? "en-IN";
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[result.currency] ?? "";
  return `${sym}${nf.format(result.prizePool)}`;
}

function formatPayout(result: SplitResult, payout: number): string {
  return formatMoney(payout, result.currency);
}

/** Single source for payout formatting */
export function formatPayoutAnnouncement(
  result: SplitResult,
  ctx: PrizePublishContext | undefined,
  style: AnnouncementStyle
): string {
  const hdr = headerLines(ctx);

  if (style === "plain") {
    const lines: string[] = [];
    if (hdr.length) { lines.push(...hdr); lines.push(""); }
    lines.push(`Prize Pool: ${localePool(result)}`);
    lines.push("");
    for (const p of result.placements) {
      lines.push(`${p.label} — ${p.percentage}% — ${formatPayout(result, p.payout)}`);
    }
    lines.push("");
    lines.push(`Total Distributed: ${formatPayout(result, result.totalDistributed)}`);
    if (result.remainingMinor !== 0) lines.push(`Remaining: ${formatPayout(result, result.remaining)}`);
    return lines.join("\n");
  }

  if (style === "discord") {
    const lines: string[] = [];
    if (hdr.length) {
      const formattedHdr = hdr.map((h, i) => (i === 0 ? `**${h}**` : h));
      lines.push(...formattedHdr);
      lines.push("");
    }
    lines.push(`**Prize Pool: ${localePool(result)}**`);
    lines.push("");
    lines.push("```text");
    for (const p of result.placements) {
      lines.push(`${p.label} — ${p.percentage}% — ${formatPayout(result, p.payout)}`);
    }
    lines.push("");
    lines.push(`Total Distributed: ${formatPayout(result, result.totalDistributed)}`);
    if (result.remainingMinor !== 0) lines.push(`Remaining: ${formatPayout(result, result.remaining)}`);
    lines.push("```");
    return lines.join("\n");
  }

  if (style === "whatsapp") {
    const lines: string[] = [];
    if (hdr.length) {
      // restrained emoji: trophy on first line only
      const first = hdr[0] ? `🏆 ${hdr[0]}` : "";
      if (first) lines.push(first);
      for (let i = 1; i < hdr.length; i++) lines.push(hdr[i] as string);
      lines.push("");
    }
    lines.push(`Prize Pool: ${localePool(result)}`);
    lines.push("");
    for (const p of result.placements) {
      lines.push(`${p.label} — ${p.percentage}% — ${formatPayout(result, p.payout)}`);
    }
    lines.push("");
    lines.push(`Total Distributed: ${formatPayout(result, result.totalDistributed)}`);
    return lines.join("\n");
  }

  // x — compact summary
  {
    const lines: string[] = [];
    if (ctx?.tournamentName?.trim()) lines.push(`🏆 ${ctx.tournamentName.trim()}`);
    else lines.push(`🏆 Prize Pool Split`);
    lines.push("");
    lines.push(`${localePool(result)} prize pool`);
    // Show up to 5 placements compact; truncate rest
    const max = 5;
    const shown = result.placements.slice(0, max);
    for (const p of shown) {
      lines.push(`${p.label} ${formatPayout(result, p.payout)}`);
    }
    if (result.placements.length > max) {
      lines.push(`+${result.placements.length - max} more`);
    }
    lines.push("");
    const pctStr = result.placements.map((p) => `${p.percentage}`).join("/");
    lines.push(`${pctStr} payout split.`);
    // Deterministic truncation to ~280 chars for X practical length
    let out = lines.join("\n");
    if (out.length > 280) {
      // truncate conservatively: keep header + first 3 placements
      const shortLines: string[] = [];
      if (ctx?.tournamentName?.trim()) shortLines.push(`🏆 ${ctx.tournamentName.trim()}`);
      shortLines.push(`${localePool(result)} prize pool`);
      for (const p of result.placements.slice(0, 3)) shortLines.push(`${p.label} ${formatPayout(result, p.payout)}`);
      if (result.placements.length > 3) shortLines.push(`+${result.placements.length - 3} more`);
      out = shortLines.join("\n");
      if (out.length > 280) out = out.slice(0, 277) + "...";
    }
    return out;
  }
}
