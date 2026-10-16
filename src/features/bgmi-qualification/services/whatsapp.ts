import { appendPublicUrl, buildWhatsAppShareUrl, truncateForShare, WHATSAPP_PREFILL_BUDGET } from "@/lib/share/whatsapp";
import type { QualificationScenario } from "../types";

/**
 * WhatsApp share composer for qualification checks.
 *
 * Plain-text, no code fences, values first, share URL on the final line
 * (via the shared appendPublicUrl primitive). Pure: no network, no
 * storage. Banned trust words must never appear — enforced by test.
 */

export interface WhatsAppCheckInput {
  readonly current: number;
  readonly target: number;
  readonly matches: number;
  readonly pointsNeeded: number;
  readonly scenario: QualificationScenario | null;
  readonly scenarioTotal: number | null;
  readonly projected: number | null;
  readonly verdictLine: string;
}

export function buildQualificationWhatsAppMessage(input: WhatsAppCheckInput, shareUrl: string): string {
  const lines = [
    "BGMI Qualification Check",
    "",
    `Current: ${input.current} pts`,
    `Target: ${input.target} pts`,
    `Matches left: ${input.matches}`,
    "",
    input.pointsNeeded <= 0 ? "Target met on points." : `Need: +${input.pointsNeeded} pts`,
    "",
  ];
  if (input.scenario && input.scenarioTotal !== null && input.projected !== null) {
    lines.push(
      "What if:",
      `${ordinal(input.scenario.placement)} + ${input.scenario.finishes} finishes`,
      `→ +${input.scenarioTotal} pts`,
      `→ ${input.projected} projected`,
      "",
      input.verdictLine
    );
  } else {
    lines.push(input.verdictLine);
  }
  const { text } = truncateForShare(lines.join("\n"), WHATSAPP_PREFILL_BUDGET);
  return appendPublicUrl(text, shareUrl);
}

export function buildQualificationWhatsAppUrl(input: WhatsAppCheckInput, shareUrl: string): string {
  return buildWhatsAppShareUrl(buildQualificationWhatsAppMessage(input, shareUrl));
}

function ordinal(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}
