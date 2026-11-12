/**
 * Tournament Scenario Generator — practice scenario bank (V1).
 *
 * Each scenario pairs AUTHOR-FREE source facts (recorded read-only from the
 * published Tournament Hub: BMSD 2026 Grand Finals, source revision 720523)
 * with LAB-AUTHORED decision framing (situation, question, options, takeaway).
 * The two layers live in separate fields so the island can label them
 * honestly: "recorded outcome" vs "Lab takeaway (analysis, not history)".
 *
 * What the source proves: match number, map, day, team, placement, finishes,
 * total points. What it does NOT prove: zone positions, rotations, loot,
 * kills beyond the finish count, IGL intent, comms, or why any team acted.
 * Options therefore ask which approach the PLAYER would prioritize, and
 * `alignsWithOutcome` marks the option whose priority best describes the
 * recorded outcome profile — never a claim about intent or correctness.
 *
 * Pure data + pure helpers: no React, no Supabase, no network. The bank is
 * safe to import from the client island.
 */

export interface TournamentGeneratorSourceRef {
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

export interface TournamentGeneratorTeamFact {
  readonly displayName: string;
  readonly placement: number;
  readonly finishes: number;
  readonly totalPoints: number;
}

export interface TournamentGeneratorOption {
  readonly id: string;
  readonly label: string;
  /**
   * Which priority this option expresses, in the player's own words.
   * Compared against the recorded outcome profile at reveal time.
   */
  readonly priority: string;
  /**
   * Practice-read tone shown on the option badge after selection.
   * Exactly one option per scenario is "stronger" (and aligned).
   */
  readonly tone: "stronger" | "higher-risk" | "conservative";
  /**
   * True when this option's priority best describes the recorded outcome
   * profile (Lab analysis of the numbers, not a historical claim).
   * Exactly one option per scenario.
   */
  readonly alignsWithOutcome: boolean;
  /** One-paragraph trade-off note taught regardless of the player's pick. */
  readonly rationale: string;
}

export interface TournamentGeneratorReveal {
  /** Facts only: winner + spotlight team lines from the published record. */
  readonly recordedOutcome: string;
  /** Honest comparison of the player's priority vs the recorded profile. */
  readonly comparison: string;
  /** Prefixed "Lab takeaway" in the UI — analysis, never history. */
  readonly labTakeaway: string;
}

export interface TournamentGeneratorScenario {
  readonly id: string;
  readonly theme: string;
  readonly source: TournamentGeneratorSourceRef;
  /** Squad whose recorded result the player reacts to. */
  readonly spotlight: TournamentGeneratorTeamFact;
  /** Match winner, for the recorded-outcome line. */
  readonly winner: TournamentGeneratorTeamFact;
  readonly situation: string;
  readonly question: string;
  readonly options: readonly TournamentGeneratorOption[];
  readonly reveal: TournamentGeneratorReveal;
}

const SOURCE_URL = "https://liquipedia.net/pubgmobile/BGMI_Masters_Series/Season_5";
const SOURCE_REVISION = "720523";

function ref(matchNumber: number, mapName: string, dayLabel: string): TournamentGeneratorSourceRef {
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
 * Six scenarios, six tactical themes. All facts recorded from the published
 * BMSD 2026 Grand Finals (18/18 completed, rev 720523): match, map, day,
 * team, placement, finishes, total points. Match numbers avoid the
 * Rotation Replay bank (1, 7, 11, 14, 18) so the two Lab experiences
 * never repeat the same Finals moment.
 */
export const TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS: readonly TournamentGeneratorScenario[] = [
  {
    id: "tsg-bmsd-m02-rntx-response",
    theme: "Backing up an opener",
    source: ref(2, "Erangel", "Day 1"),
    spotlight: { displayName: "Nebula Esports", placement: 2, finishes: 6, totalPoints: 12 },
    winner: { displayName: "Rntx", placement: 1, finishes: 10, totalPoints: 20 },
    situation:
      "Match 2 of 18. Day 1 continues on Erangel. Your squad opened the Finals with a statement win on Rondo — the whole lobby saw it, and the very next plane is already in the air.",
    question: "Coming off a dominant opening match, what do you prioritize in Match 2?",
    options: [
      {
        id: "m02-bank",
        label: "Protect the lead — play safe, bank placement, give nothing away",
        priority: "lead protection",
        tone: "conservative",
        alignsWithOutcome: false,
        rationale:
          "Protecting a lead feels responsible, but one match is too small a sample to defend. Sitting back hands the initiative to every squad that started slowly.",
      },
      {
        id: "m02-tempo",
        label: "Chase the same tempo — contest every drop and fight like Match 1",
        priority: "repeat aggression",
        tone: "higher-risk",
        alignsWithOutcome: false,
        rationale:
          "Trying to replay a highlight game forces fights the lobby now expects. Match 1 worked once; assuming the same openings exist on a new map is a gamble.",
      },
      {
        id: "m02-reset",
        label: "Reset and play what's in front of you — solid Erangel game, take what comes",
        priority: "balanced reset",
        tone: "stronger",
        alignsWithOutcome: true,
        rationale:
          "A reset treats each match as its own sample: positioning first, finishes as they come. It keeps a good start intact without betting it on a repeat performance.",
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 2, Erangel — Rntx won with 10 finishes and 20 points. Nebula Esports banked 2nd with 6 finishes and 12 points.",
      comparison:
        "The recorded match rewarded the balanced-reset call: the winner paired placement with 10 finishes, and the Match 1 winner backed it up with a 2nd place instead of forcing a repeat.",
      labTakeaway:
        "Good openers are banked, not chased. Playing the match in front of you converts momentum into a second countable result — that describes this one match, not a rule for every opener.",
    },
  },
  {
    id: "tsg-bmsd-m04-reckoning-volatility",
    theme: "One match proves nothing",
    source: ref(4, "Rondo", "Day 1"),
    spotlight: { displayName: "Nebula Esports", placement: 16, finishes: 4, totalPoints: 4 },
    winner: { displayName: "Reckoning Esports", placement: 1, finishes: 9, totalPoints: 19 },
    situation:
      "Match 4 of 18. Back on Rondo to close Day 1. Your squad arrived as the story of the Finals — a win and a 2nd — and has just finished 16th with 4 points. The lobby is already talking.",
    question: "A dream start just met a last-place finish. What do you take into Match 5?",
    options: [
      {
        id: "m04-overhaul",
        label: "Overhaul everything — new drops, new roles, new plan for Day 2",
        priority: "full reset",
        tone: "higher-risk",
        alignsWithOutcome: false,
        rationale:
          "Tearing up a plan that produced a win and a 2nd because of one bad game discards real evidence. Overhauls feel decisive but usually add noise, not answers.",
      },
      {
        id: "m04-writeoff",
        label: "Write off the map — Rondo is clearly not your map, avoid every contest there",
        priority: "map avoidance",
        tone: "conservative",
        alignsWithOutcome: false,
        rationale:
          "One 16th on a map you already won on is not a map problem. Avoiding Rondo would surrender a map where you have already banked 30-plus points across two games.",
      },
      {
        id: "m04-sample",
        label: "Treat it as one sample — keep the plan, reset heads, play the next match",
        priority: "steady reset",
        tone: "stronger",
        alignsWithOutcome: true,
        rationale:
          "Eighteen matches absorb single-game swings. Keeping a proven plan through one 16th protects the process that built the good start in the first place.",
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 4, Rondo — Reckoning Esports won with 9 finishes and 19 points. Nebula Esports finished 16th with 4 finishes and 4 points.",
      comparison:
        "The recorded match rewarded the steady-reset call: the same squad that won Match 1 finished last here, while a different winner emerged — Day 1 volatility, not a verdict on anyone's plan.",
      labTakeaway:
        "Early tables lie in both directions. A win plus a 2nd plus a 16th is just three samples of eighteen — reacting to any single one, good or bad, overfits the noise.",
    },
  },
  {
    id: "tsg-bmsd-m06-tamilas-efficiency",
    theme: "The efficient win",
    source: ref(6, "Erangel", "Day 1"),
    spotlight: { displayName: "Team Tamilas", placement: 1, finishes: 6, totalPoints: 16 },
    winner: { displayName: "Team Tamilas", placement: 1, finishes: 6, totalPoints: 16 },
    situation:
      "Match 6 of 18. Day 1 closes on Erangel. Your squad is not the lobby's frag-heavy bully — your edge is discipline, positioning, and converting the games you survive deep into.",
    question: "You can't out-frag the lobby favourites. Which route do you trust to win a match?",
    options: [
      {
        id: "m06-force",
        label: "Force the issue — take early fights to match the favourites' finish totals",
        priority: "forced aggression",
        tone: "higher-risk",
        alignsWithOutcome: false,
        rationale:
          "Borrowing someone else's identity usually ends badly. Forcing fights against stronger gun squads risks the placement points your actual game is built to collect.",
      },
      {
        id: "m06-info",
        label: "Play for information — track the lobby and third-party the late game",
        priority: "information",
        tone: "conservative",
        alignsWithOutcome: false,
        rationale:
          "Information helps, but waiting for scraps concedes control of the endgame. Third-party plans need a team in position to convert — survival alone doesn't win matches.",
      },
      {
        id: "m06-convert",
        label: "Survive deep and convert — win the endgame with the finishes that come to you",
        priority: "efficient conversion",
        tone: "stronger",
        alignsWithOutcome: true,
        rationale:
          "Placement points do heavy lifting in Finals scoring. Surviving deep with even a modest finish count can outscore a bloodbath that ends 8th — efficiency is a real route to wins.",
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 6, Erangel — Team Tamilas won with 6 finishes and 16 points, the lowest winning finish count of Day 1.",
      comparison:
        "The recorded match rewarded the efficient-conversion call: just 6 finishes plus the win banked 16 points — proof in this lobby that placement can carry a winning total.",
      labTakeaway:
        "You don't need the lobby's highest frag total to win its matches. Conversion efficiency — surviving deep and finishing the game — is its own win condition in Finals scoring.",
    },
  },
  {
    id: "tsg-bmsd-m10-apex-breakthrough",
    theme: "Finishes without the win",
    source: ref(10, "Rondo", "Day 2"),
    spotlight: { displayName: "Orangutan", placement: 3, finishes: 14, totalPoints: 19 },
    winner: { displayName: "Team Apex Gaming", placement: 1, finishes: 13, totalPoints: 23 },
    situation:
      "Match 10 of 18. Day 2 on Rondo. Your gunfights are online: the squad is fragging with anyone, but the wins keep slipping to other teams at the death.",
    question: "Mid-Day 2, fragging well but not winning. What do you prioritize?",
    options: [
      {
        id: "m10-gamble",
        label: "Gamble the rotations — force unfamiliar compounds to steal the win",
        priority: "forced win",
        tone: "higher-risk",
        alignsWithOutcome: false,
        rationale:
          "Forcing unfamiliar territory to chase a win usually breaks the very gun game that's working. Desperation rotations trade a functioning identity for a lottery ticket.",
      },
      {
        id: "m10-tighten",
        label: "Tighten up — stop taking fights, protect placement at all costs",
        priority: "placement lockdown",
        tone: "conservative",
        alignsWithOutcome: false,
        rationale:
          "Locking down abandons your working edge. A fragging squad that stops fighting often discovers its placement game was never the strength — and banks less, not more.",
      },
      {
        id: "m10-back",
        label: "Back your gunfights — keep stacking finishes, trust the wins to follow",
        priority: "finishes-first",
        tone: "stronger",
        alignsWithOutcome: true,
        rationale:
          "Finishes bank points even when wins slip. A squad fragging at this rate stays in the table race every single game — and pressure like that eventually converts.",
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 10, Rondo — Team Apex Gaming won with 13 finishes and 23 points. Orangutan finished 3rd with 14 finishes and 19 points — out-fragging the winner.",
      comparison:
        "The recorded match rewarded the finishes-first call: 14 finishes banked 19 points without the win — more than most placements pay, and within sight of the winning total.",
      labTakeaway:
        "Aggression can pay even when the chicken dinner slips away. When your edge is gun skill, protecting the frag rate protects your floor — the win is a bonus, not the only payout.",
    },
  },
  {
    id: "tsg-bmsd-m15-ceiling-floor",
    theme: "Ceiling and floor, same lobby",
    source: ref(15, "Miramar", "Day 3"),
    spotlight: { displayName: "Gladiators Esports", placement: 16, finishes: 0, totalPoints: 0 },
    winner: { displayName: "Orangutan", placement: 1, finishes: 14, totalPoints: 24 },
    situation:
      "Match 15 of 18. Final day, Miramar. Your squad is a genuine table contender — and has just blanked: 16th, zero finishes, zero points, while a rival posted a 14-finish win in the same lobby.",
    question: "Finals day, one blank game behind you. What do you carry into the next match?",
    options: [
      {
        id: "m15-chase",
        label: "Chase the response — match their aggression, post a monster game of your own",
        priority: "revenge aggression",
        tone: "higher-risk",
        alignsWithOutcome: false,
        rationale:
          "Chasing someone else's peak borrows their game plan at the worst moment. Forced monster games usually produce a second blank, not a statement.",
      },
      {
        id: "m15-hide",
        label: "Go ultra-safe — hide all game, take whatever placement the lobby gives you",
        priority: "pure survival",
        tone: "conservative",
        alignsWithOutcome: false,
        rationale:
          "Pure survival after a blank compounds the damage: it concedes the finishes your rivals are collecting and shrinks your remaining games to damage control.",
      },
      {
        id: "m15-floor",
        label: "Steady the floor — play your normal game, survive deep, stop the bleed",
        priority: "floor reset",
        tone: "stronger",
        alignsWithOutcome: true,
        rationale:
          "A blank is one sample, even on Day 3. Returning to your normal game restores the floor that made you a contender — the table rewards the next countable result, not the loudest response.",
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 15, Miramar — Orangutan won with 14 finishes and 24 points. Gladiators Esports finished 16th with 0 finishes and 0 points — ceiling and floor in one lobby.",
      comparison:
        "The recorded match rewarded the floor-reset call: the same lobby held a 24-point peak and a zero in the same game, which is exactly why one result can't define a contender.",
      labTakeaway:
        "Finals day magnifies single games, but the table still counts all eighteen. The published record shows Gladiators went on to win Match 18 — a blank is a bad game, not a verdict.",
    },
  },
  {
    id: "tsg-bmsd-m17-momentum-answer",
    theme: "Answering a peak",
    source: ref(17, "Miramar", "Day 3"),
    spotlight: { displayName: "Nebula Esports", placement: 3, finishes: 5, totalPoints: 10 },
    winner: { displayName: "Orangutan", placement: 1, finishes: 14, totalPoints: 24 },
    situation:
      "Match 17 of 18. One game left after this on Miramar. A rival has just posted their second 14-finish win of the final day — the lobby's peak keeps getting higher, and you are not the ones setting it.",
    question: "A rival is peaking and everyone can see it. What do you prioritize?",
    options: [
      {
        id: "m17-match",
        label: "Match them head-on — contest their drops and take the fight to the peak",
        priority: "direct challenge",
        tone: "higher-risk",
        alignsWithOutcome: false,
        rationale:
          "Challenging a peaking squad on their terms is the highest-variance play available. Peaks end on their own — running into one rarely ends them sooner.",
      },
      {
        id: "m17-hide",
        label: "Disappear — avoid every top squad and take whatever placement survives",
        priority: "avoidance",
        tone: "conservative",
        alignsWithOutcome: false,
        rationale:
          "Avoidance banks small results while rivals keep collecting. Hiding from the lobby's best doesn't stop them scoring — it just removes you from the games that matter.",
      },
      {
        id: "m17-own",
        label: "Play your own game — solid rotations, bankable points, no highlight chasing",
        priority: "own game",
        tone: "stronger",
        alignsWithOutcome: true,
        rationale:
          "Someone else's peak doesn't change your win condition. Bankable points from your own game keep you moving while the lobby orbits the highlight — consistency compounds.",
      },
    ],
    reveal: {
      recordedOutcome:
        "Match 17, Miramar — Orangutan won with 14 finishes and 24 points, their second monster win of Day 3. Nebula Esports finished 3rd with 5 finishes and 10 points.",
      comparison:
        "The recorded match rewarded the own-game call: the peak didn't require everyone else to collapse — 3rd with 5 finishes banked a solid 10 points right beside a 24-point game.",
      labTakeaway:
        "Peaks are loud but narrow: one squad's monster game leaves fifteen other results on the table. Playing your own game collects the points the highlight leaves behind.",
    },
  },
];

export const TOURNAMENT_SCENARIO_GENERATOR_TOTAL = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.length;

/** Deterministic scenario order — the bank order is the session order. */
export function getTournamentScenarioGeneratorScenario(id: string): TournamentGeneratorScenario | null {
  return TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.find((s) => s.id === id) ?? null;
}

/** Canonical share path — no result URLs, no parameters. */
export const TOURNAMENT_SCENARIO_GENERATOR_PATH = "/bgmi-lab/tournament-scenario-generator";
