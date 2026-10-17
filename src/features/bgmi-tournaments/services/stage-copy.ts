/**
 * BGMI Tournament Hub — stage presentation copy.
 *
 * Pure content helpers for the public stage page. No scoring, ingestion,
 * or business logic lives here — only the words, driven by data the
 * page already has (stage status, Smash state, match counts).
 */

export interface StageMessagingInput {
  readonly status: string;
  readonly smashRule: boolean;
  readonly matchPointThreshold: number | null;
  readonly completedMatches: number;
  readonly totalMatches: number;
}

export interface StageMessaging {
  /** Smash explanation callout; null when the stage has no Smash Rule. */
  readonly smashCallout: string | null;
  /** Standings section heading. */
  readonly standingsHeading: "Standings" | "Current points race";
  /** Supporting note under the heading; null when standings are final. */
  readonly standingsNote: string | null;
}

function completedSmashCallout(matchPointThreshold: number | null): string {
  return (
    "This stage ended with a Smash Rule (match-point) format" +
    (matchPointThreshold !== null ? ` — the match-point threshold was ${matchPointThreshold} points` : "") +
    ". The table below shows the points race; final positions were decided by the match-point rule, not by points alone."
  );
}

export function stageMessaging(input: StageMessagingInput): StageMessaging {
  if (!input.smashRule) {
    return { smashCallout: null, standingsHeading: "Standings", standingsNote: null };
  }
  if (input.status === "completed") {
    return {
      smashCallout: completedSmashCallout(input.matchPointThreshold),
      standingsHeading: "Standings",
      standingsNote: null,
    };
  }
  const remaining = Math.max(0, input.totalMatches - input.completedMatches);
  const lead =
    `This stage is still ongoing — ${input.completedMatches} of ${input.totalMatches} ` +
    `matches are complete, with the final ${remaining} matches still to play.`;
  const smash =
    input.matchPointThreshold !== null
      ? ` The remaining matches use the Smash Rule (match-point format) with a ${input.matchPointThreshold}-point ` +
        `threshold. A team that reaches ${input.matchPointThreshold} points becomes Match Point Eligible, but must ` +
        `then win a Chicken Dinner in a later match to become champion. If no eligible team wins a later match by ` +
        `Match ${input.totalMatches}, the team with the most points wins.`
      : " The Smash Rule (match-point format) is active for the remaining matches.";
  return {
    smashCallout: lead + smash,
    standingsHeading: "Current points race",
    standingsNote:
      "These standings are not final — the champion will be decided by the Smash Rule in the remaining matches.",
  };
}
