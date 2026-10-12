/**
 * Prize Payout Tracker — WhatsApp message composer.
 *
 * Highest privacy sensitivity of all tools: the default message is a
 * short announcement (event name + record status + the existing public
 * token URL) and MUST NEVER inline recipient rows, prize amounts, payment
 * references, last-four references, or proof links. An optional
 * user-supplied note may be appended — it is caller-provided text, never
 * auto-filled from private fields. No query-param payout data, ever.
 */

export interface PayoutWhatsAppInput {
  readonly eventName: string;
  /** Record status from the actual tracker row. */
  readonly status: "published" | "completed";
  readonly publicUrl: string;
  /** Optional caller-supplied note (e.g. from the message editor). */
  readonly note?: string | undefined;
}

export function buildPayoutWhatsAppMessage(input: PayoutWhatsAppInput): string {
  const lines: string[] = [];
  lines.push(input.eventName);
  lines.push(
    input.status === "completed"
      ? "Prize payout record is complete — all recipients marked paid."
      : "Prize payout record is published.",
  );
  const note = input.note?.trim();
  if (note) {
    lines.push("");
    lines.push(note);
  }
  lines.push("");
  lines.push("View the organizer-reported payout record:");
  lines.push(input.publicUrl);
  return lines.join("\n");
}
