import { appendPublicUrl } from "@/lib/share/whatsapp";

/**
 * BGMI Lab share-message composer — pure, no React, no browser APIs.
 *
 * Builds the honest result message from the actual score plus the
 * registry `shareText` and the canonical game URL. No claims, no
 * tracking parameters, no result-specific URLs. Reused by ShareRow
 * (and future Lab games) so copy never drifts between channels.
 */

export interface LabShareInput {
  readonly gameName: string;
  readonly score: number;
  readonly total: number;
  readonly shareText: string;
  readonly canonicalUrl: string;
  /**
   * Result noun for the headline ("good reads" for Circle IQ,
   * "lined-up reads" for Rotation Replay). Defaults to "good reads"
   * so existing callers keep Circle IQ wording unchanged.
   */
  readonly resultNoun?: string;
}

/**
 * Message shape:
 *
 *   I scored 6/8 good reads on Circle IQ.
 *   I practiced my zone reads in Circle IQ — a free BGMI rotation drill. Can you make the call?
 *
 *   View online: https://…/bgmi-lab/circle-iq
 */
export function buildLabShareMessage(input: LabShareInput): string {
  const noun = input.resultNoun ?? "good reads";
  const headline = `I scored ${input.score}/${input.total} ${noun} on ${input.gameName}.`;
  return appendPublicUrl(`${headline}\n${input.shareText}`, input.canonicalUrl);
}

/** Cancellation of the native share sheet is not an application error. */
export function isShareAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
