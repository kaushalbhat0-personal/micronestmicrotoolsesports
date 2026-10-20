/**
 * Rotation Replay scenario bank — first tournament-derived BGMI Lab release.
 *
 * Each scenario pairs AUTHOR-FREE source facts (recorded read-only from the
 * published Tournament Hub: BMSD 2026 Grand Finals, source revision 720523)
 * with LAB-AUTHORED decision framing (situation, question, options, takeaway).
 * The two layers are kept in separate fields so the island can label them
 * honestly: "recorded outcome" vs "Lab takeaway (analysis, not history)".
 *
 * What the source proves: match number, map, day, team, placement, finishes,
 * total points. What it does NOT prove: which approach the team used, why
 * they rotated, or whether another route was better. Options therefore ask
 * which approach the PLAYER would prioritize, and `alignsWithOutcome` marks
 * the option whose priority best describes the recorded outcome profile —
 * never a claim about intent or correctness.
 *
 * Pure data + pure helpers: no React, no Supabase, no network. The bank is
 * safe to import from the client island.
 */

export interface RotationReplaySourceRef {
  readonly tournamentSlug: string;
  readonly stageSlug: string;
  readonly matchNumber: number;
  readonly matchId: string;
  readonly mapName: string;
  /** Day label derived from the published schedule (e.g. "Day 1"). */
  readonly dayLabel: string;
  readonly sourceRevision: string;
  readonly sourceUrl: string;
}

export interface RotationReplayTeamFact {
  readonly displayName: string;
  readonly placement: number;
  readonly finishes: number;
  readonly totalPoints: number;
}

export interface RotationReplayOption {
  readonly id: string;
  readonly label: string;
  /**
   * Which priority this option expresses, in the player's own words.
   * Compared against the recorded outcome profile at reveal time.
   */
  readonly priority: string;
  /**
   * True when this option's priority best describes the recorded outcome
   * profile (Lab analysis of the numbers, not a historical claim).
   * Exactly one option per scenario.
   */
  readonly alignsWithOutcome: boolean;
}

export interface RotationReplayReveal {
  /** Facts only: winner + focus team lines from the published record. */
  readonly recordedOutcome: string;
  /** Honest comparison of the player's priority vs the recorded profile. */
  readonly comparison: string;
  /** Prefixed "Lab takeaway" in the UI — analysis, never history. */
  readonly labTakeaway: string;
}

export interface RotationReplayScenario {
  readonly id: string;
  readonly pattern: string;
  readonly source: RotationReplaySourceRef;
  /** Spotlight team whose recorded result the player reacts to. */
  readonly focusTeam: RotationReplayTeamFact;
  /** Match winner, for the recorded-outcome line. */
  readonly winner: RotationReplayTeamFact;
  readonly situation: string;
  readonly question: string;
  readonly options: readonly RotationReplayOption[];
  readonly reveal: RotationReplayReveal;
}

const SOURCE_URL = "https://liquipedia.net/pubgmobile/BGMI_Masters_Series/Season_5";
const SOURCE_REVISION = "720523";

function ref(matchNumber: number, mapName: string, dayLabel: string): RotationReplaySourceRef {
  return {
    tournamentSlug: "bmsd-2026",
    stageSlug: "grand-finals",
    matchNumber,
    matchId: `match-${matchNumber}`,
    mapName,
    dayLabel,
    sourceRevision: SOURCE_REVISION,
    sourceUrl: SOURCE_URL,
  };
}

/**
 * Five scenarios, five decision patterns. All facts recorded from the
 * published BMSD 2026 Grand Finals (18/18 completed, rev 720523):
 * match, map, day, team, placement, finishes, total points.
 */
export const ROTATION_REPLAY_SCENARIOS: readonly RotationReplayScenario[] = [
  {
    id: "rr-bmsd-m01-nebula-opener",
    pattern: "Opening statement vs slow burn",
    source: ref(1, "Rondo", "Day 1"),
    focusTeam: { displayName: "Nebula Esports", placement: 1, finishes: 20, totalPoints: 30 },
    winner: { displayName: "Nebula Esports", placement: 1, finishes: 20, totalPoints: 30 },
    situation:
      "Match 1 of 18. The Grand Finals lobby is fresh on Rondo and nobody has a read on anyone yet — no form, no momentum, just the opening plane path.",
    question: "You are dropping into the first match of the Finals. What do you prioritize?",
    options: [
      {
        id: "m01-info",
        label: "Play for information — scout rotations and commit late",
        priority: "information",
        alignsWithOutcome: false,
      },
      {
        id: "m01-placement",
        label: "Secure placement first — survive deep, take fights late",
        priority: "placement",
        alignsWithOutcome: false,
      },
      {
        id: "m01-finishes",
        label: "Set the tone early — contest drops and fight for finishes",
        priority: "finishes",
        alignsWithOutcome: true,
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 1, Rondo — Nebula Esports won with 20 finishes and 30 points, the loudest opening statement of the Finals.",
      comparison:
        "The recorded match rewarded the finishes-first call: 20 finishes banked more than half of the winning total.",
      labTakeaway:
        "A Day 1 opener can reward taking fights before the lobby settles. That describes this one match — not a rule for every opener.",
    },
  },
  {
    id: "rr-bmsd-m07-tamilas-aggression",
    pattern: "Finishes without the win",
    source: ref(7, "Rondo", "Day 2"),
    focusTeam: { displayName: "Team Tamilas", placement: 4, finishes: 14, totalPoints: 18 },
    winner: { displayName: "Gladiators Esports", placement: 1, finishes: 17, totalPoints: 27 },
    situation:
      "Match 7 of 18. It is Day 2 on Rondo and the table is taking shape. Your squad is mid-pack — close enough to strike, far enough that one bad game hurts.",
    question: "Mid-table on Day 2, with the lobby heating up. What do you prioritize?",
    options: [
      {
        id: "m07-placement",
        label: "Protect the floor — guarantee points with a deep placement",
        priority: "placement",
        alignsWithOutcome: false,
      },
      {
        id: "m07-info",
        label: "Play for information — track who is contesting which compounds",
        priority: "information",
        alignsWithOutcome: false,
      },
      {
        id: "m07-finishes",
        label: "Back your gunfights — stack finishes even if the win slips",
        priority: "finishes",
        alignsWithOutcome: true,
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 7, Rondo — Gladiators Esports won (17 finishes, 27 points). Team Tamilas finished 4th with 14 finishes and 18 points.",
      comparison:
        "The recorded match rewarded the finishes-first call: 14 finishes banked 18 points without a win — more than most placements pay.",
      labTakeaway:
        "Aggression can pay even when the chicken dinner slips away. Placement points still decided the win, but finishes kept Tamilas in the race.",
    },
  },
  {
    id: "rr-bmsd-m11-soul-response",
    pattern: "Mid-tournament response game",
    source: ref(11, "Miramar", "Day 2"),
    focusTeam: { displayName: "Team Soul", placement: 1, finishes: 11, totalPoints: 21 },
    winner: { displayName: "Team Soul", placement: 1, finishes: 11, totalPoints: 21 },
    situation:
      "Match 11 of 18. Day 2 continues on Miramar — long sightlines, punishing open ground, and a lobby that has now seen everyone play twice.",
    question: "Two days in, every team has film on everyone. What do you prioritize?",
    options: [
      {
        id: "m11-finishes",
        label: "Force the issue — crash compounds and farm third-parties",
        priority: "finishes",
        alignsWithOutcome: false,
      },
      {
        id: "m11-info",
        label: "Play for information — use the film you have and rotate around trouble",
        priority: "information",
        alignsWithOutcome: false,
      },
      {
        id: "m11-balance",
        label: "Reset and respond — clean early game, then convert the endgame",
        priority: "placement",
        alignsWithOutcome: true,
      },
    ],
    reveal: {
      recordedOutcome: "Match 11, Miramar — Team Soul won with 11 finishes and 21 points on Day 2.",
      comparison:
        "The recorded match rewarded the reset-and-convert call: a controlled game that peaked exactly when the points were richest.",
      labTakeaway:
        "Mid-tournament response games are about timing the peak, not leading every minute. Soul's win came from converting the endgame, not dominating the drop.",
    },
  },
  {
    id: "rr-bmsd-m14-8bit-control",
    pattern: "Day 3 control under pressure",
    source: ref(14, "Erangel", "Day 3"),
    focusTeam: { displayName: "8bit", placement: 1, finishes: 12, totalPoints: 22 },
    winner: { displayName: "8bit", placement: 1, finishes: 12, totalPoints: 22 },
    situation:
      "Match 14 of 18. Final day on Erangel — four matches left, every point carries table weight, and the lobby knows it.",
    question: "Final day, Erangel, everything on the line. What do you prioritize?",
    options: [
      {
        id: "m14-finishes",
        label: "Chase the lobby — hunt the teams above you for finishes",
        priority: "finishes",
        alignsWithOutcome: false,
      },
      {
        id: "m14-info",
        label: "Play for information — let others clash and pick the leftovers",
        priority: "information",
        alignsWithOutcome: false,
      },
      {
        id: "m14-control",
        label: "Control what you can — clean rotations, own your compound, win your fights",
        priority: "placement",
        alignsWithOutcome: true,
      },
    ],
    reveal: {
      recordedOutcome: "Match 14, Erangel — 8bit won with 12 finishes and 22 points on the final day.",
      comparison:
        "The recorded match rewarded the control-first call: 8bit banked a full win with 12 finishes behind it — pressure handled, not chased.",
      labTakeaway:
        "On finals day, control scales better than chaos. A clean game with a dozen finishes beat every gamble in this lobby.",
    },
  },
  {
    id: "rr-bmsd-m18-finale-routes",
    pattern: "Two routes to the same total",
    source: ref(18, "Erangel", "Day 3"),
    focusTeam: { displayName: "Rapid Chaos Esports", placement: 4, finishes: 13, totalPoints: 17 },
    winner: { displayName: "Gladiators Esports", placement: 1, finishes: 7, totalPoints: 17 },
    situation:
      "Match 18 of 18. The last game of the Grand Finals on Erangel — whatever happens here is the final line of the table.",
    question: "Last match of the Finals. The table is nearly set. What do you prioritize?",
    options: [
      {
        id: "m18-finishes",
        label: "Empty the tank — maximum aggression, finishes at any cost",
        priority: "finishes",
        alignsWithOutcome: false,
      },
      {
        id: "m18-info",
        label: "Play for information — stay alive and read how the finale unfolds",
        priority: "information",
        alignsWithOutcome: false,
      },
      {
        id: "m18-placement",
        label: "Win the game first — placement decides the finale, finishes follow",
        priority: "placement",
        alignsWithOutcome: true,
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 18, Erangel — Gladiators Esports won with 7 finishes and 17 points. Rapid Chaos Esports finished 4th with 13 finishes — also 17 points.",
      comparison:
        "The recorded match rewarded the placement-first call: both routes banked 17 points, but the win — and the finale — went to placement.",
      labTakeaway:
        "Two routes reached the same total: 7 finishes plus the win equalled 13 finishes without it. When totals tie, placement breaks them.",
    },
  },
];

export const ROTATION_REPLAY_TOTAL = ROTATION_REPLAY_SCENARIOS.length;

export function getRotationReplayScenario(id: string): RotationReplayScenario | null {
  return ROTATION_REPLAY_SCENARIOS.find((s) => s.id === id) ?? null;
}

/** Canonical share path — no result URLs, no parameters. */
export const ROTATION_REPLAY_PATH = "/bgmi-lab/rotation-replay";
