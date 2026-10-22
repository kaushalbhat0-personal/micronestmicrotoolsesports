/**
 * BGMI Lab registry — public free practice/learning tools.
 *
 * Structural separation (architectural boundary):
 * - No internalSlug, no TOOL_PLAN_PREFIX, no plan IDs, no prices.
 * - No entitlement, billing, auth, organization, or Supabase imports.
 * - `status` is a public-discovery flag only —
 *   never the workspace `comingSoon` semantics.
 *
 * Status semantics:
 * - "available"    → public route + sitemap + index listing.
 * - "planned"      → index card only (no route, 404s, never in sitemap).
 * - "experimental" → route may exist for testing, but noindex + never in sitemap.
 * - "archived"     → hidden from the normal index; no new links.
 *   (No redirect convention exists yet — do not invent one here.)
 *
 * Only "available" tools get routes/sitemap/indexing. "planned" entries
 * are catalog data for the Lab index (coming-soon cards, no pages).
 * "experimental" entries resolve to routes only when a game island exists
 * in the loader map, and always render noindex metadata.
 */

export type BgmiLabStatus = "available" | "planned" | "experimental" | "archived";

export type BgmiLabCategory = "practice" | "learn" | "fun";

export type BgmiLabScenarioKind = "synthetic" | "tournament-derived";

export interface BgmiLabScenarioRef {
  readonly tournamentSlug?: string;
  readonly stageSlug?: string;
  readonly matchId?: string;
  readonly sourceRevision?: string;
}

export interface BgmiLabFaq {
  readonly question: string;
  readonly answer: string;
}

export interface BgmiLabTool {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly icon: string;
  readonly status: BgmiLabStatus;
  readonly category: BgmiLabCategory;
  readonly scenarioKind: BgmiLabScenarioKind;
  readonly scenarioRef?: BgmiLabScenarioRef;
  readonly methodology: string;
  readonly instructions: readonly string[];
  readonly faqs: readonly BgmiLabFaq[];
  readonly examples?: readonly string[];
  readonly tournamentContext?: string;
  readonly disclaimer?: string;
  readonly relatedHubHref?: string;
  readonly relatedSimulatorHref?: string;
  /** Concise direct-answer block (AEO) for available games. Plain factual prose. */
  readonly answer?: string;
  /** Future-ready share sentence (no share UX built yet). Canonical URL is appended at share time. */
  readonly shareText?: string;
  /** Motif line for the shared OG image generator. */
  readonly ogMotif?: string;
}

const DISCLAIMER =
  "Practice estimates for learning and discussion. Scoring formats vary by event — always check the official rulebook before a match.";

export const BGMI_LAB_TOOLS: readonly BgmiLabTool[] = [
  {
    slug: "circle-iq",
    name: "Circle IQ",
    tagline: "Read the zone, pick the smarter rotation.",
    description:
      "Circle IQ is a free BGMI practice drill: study a zone snapshot and choose the rotation call an IGL would make. Instant feedback, no signup, no score saved.",
    icon: "Target",
    status: "available",
    category: "practice",
    scenarioKind: "synthetic",
    answer:
      "Circle IQ is a free BGMI practice drill that shows a zone snapshot and asks you to pick the safer rotation. Each round gives instant feedback explaining the call, so the reasoning transfers to real matches. Nothing is predicted, nothing is saved, and no signup is needed.",
    shareText: "I practiced my zone reads in Circle IQ — a free BGMI rotation drill. Can you make the call?",
    ogMotif: "ZONE READ · BGMI LAB",
    methodology:
      "Each round presents a zone snapshot (circle position, nearby cover, open ground) with two or three rotation options. The recommended call follows a simple published heuristic: prefer cover over distance, avoid crossing open ground late, and rotate early when the next circle pulls away. The drill explains every answer so the reasoning transfers to real matches.",
    instructions: [
      "Study the zone snapshot: your position, the next circle, and nearby cover.",
      "Pick the rotation you would call as IGL.",
      "Read the feedback — it explains why the recommended call is safer.",
      "Replay the round with a fresh snapshot and compare your calls.",
    ],
    faqs: [
      {
        question: "Is Circle IQ free?",
        answer: "Yes. Circle IQ is free to use with no signup and no saved score.",
      },
      {
        question: "How is my score calculated?",
        answer:
          "Each of the 8 rounds has one stronger call. Picking it earns one good read, for 8 possible good reads in a full run. The score is ephemeral — nothing is saved and there is no leaderboard.",
      },
      {
        question: "Does Circle IQ predict real match zones?",
        answer: "No. It is a practice drill with illustrative snapshots — it teaches rotation reasoning, not zone prediction.",
      },
      {
        question: "How is Circle IQ different from the Qualification Simulator?",
        answer:
          "The Qualification Simulator plans points against a target. Circle IQ practices a single skill: choosing safer rotations from zone snapshots.",
      },
    ],
    examples: [
      "Example: circle pulls across open ground — the recommended call rotates early along cover instead of holding the compound.",
      "Example: split circle with a ridge — the recommended call takes the ridge side with hard cover over the shorter open-field run.",
    ],
    tournamentContext:
      "Zone rotations decide BGMI tournament placements every week — see how real teams handle them in the BGMI Tournament Hub standings and match results.",
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "rotation-iq",
    name: "Rotation IQ",
    tagline: "Time your move like a planner, not a gambler.",
    description: "Free BGMI rotation-timing drill: decide when to move and when to hold. Planned entry — not yet playable.",
    icon: "Gauge",
    status: "planned",
    category: "practice",
    scenarioKind: "synthetic",
    ogMotif: "TIMING · BGMI LAB",
    methodology: "Planned drill comparing early, timed, and late rotations against zone pressure and third-party risk.",
    instructions: ["Planned: timing scenarios are being designed."],
    faqs: [{ question: "When will Rotation IQ be available?", answer: "It is planned. Circle IQ is the available drill today." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "igl-decision-drill",
    name: "IGL Decision Drill",
    tagline: "Make the call under pressure.",
    description:
      "Free BGMI IGL drill: 6 synthetic tactical scenarios with real trade-offs. Read the situation, commit to a call, and learn the reasoning. No signup, nothing saved.",
    icon: "Crosshair",
    status: "available",
    category: "practice",
    scenarioKind: "synthetic",
    answer:
      "The IGL Decision Drill is a free BGMI practice drill with 6 synthetic tactical scenarios. Each scenario gives you an in-game leader's snapshot — teams left, position, terrain, zone, resources, threats, and timing — and asks you to commit to a fight, avoid, hold, or rotate call, then explains the reasoning behind the stronger call. Nothing is saved, and it does not predict real matches.",
    shareText:
      "I tested my IGL calls in pressure scenarios — a free BGMI decision drill. Can you make the call?",
    ogMotif: "IGL CALLS · BGMI LAB",
    methodology:
      "Each scenario presents a synthetic pressure snapshot: seven brief fields plus up to two inspectable intel facts. You commit to one fight, avoid, hold, or rotate call; the debrief shows the authored consequence, the rationale for the stronger call, why the alternatives fall short here, one transferable principle, and an uncertainty note. The stronger-call count tracks alignment with the scenario rationale — not skill, and not real-match outcomes.",
    instructions: [
      "Read the tactical brief: teams left, position, terrain, zone, resources, threats, and timing.",
      "Reveal up to two intel facts for extra context before you decide.",
      "Commit to one call — fight, avoid, hold, or rotate. The decision locks on commit.",
      "Read the debrief — consequence, rationale, principle, and uncertainty — then run the next scenario.",
    ],
    faqs: [
      {
        question: "Is the IGL Decision Drill free?",
        answer: "Yes. It is free to use with no signup and no saved score.",
      },
      {
        question: "How is my score calculated?",
        answer:
          "Each of the 6 scenarios has one stronger call. Picking it earns one stronger call, for 6 possible in a full run. The count is ephemeral and nothing is saved.",
      },
      {
        question: "Does the IGL Decision Drill predict real match outcomes?",
        answer:
          "No. Every scenario is synthetic and illustrative — it trains decision reasoning, not zone or outcome forecasting.",
      },
      {
        question: "Is there one universally right answer?",
        answer:
          "No. Each scenario names the stronger call for its specific situation and explains the trade-offs, including where that call could still fail. The drill teaches reasoning, not certainty.",
      },
      {
        question: "How is this different from Circle IQ?",
        answer:
          "Circle IQ practices zone rotations from map snapshots. The IGL Decision Drill practices tactical commitment under incomplete information — fight, avoid, hold, or rotate — across six pressure scenarios with no map.",
      },
      {
        question: "Where do the scenarios come from?",
        answer:
          "They are authored synthetic situations written for training, not records of real matches. The Tournament Hub holds the published record of real tournaments if you want to study those separately.",
      },
    ],
    examples: [
      "Example: two squads trading nearby while the zone pulls away — the stronger call slips out early instead of third-partying a fight that is not yours.",
      "Example: a split squad with one pair safe — the stronger call regroups as four before the rescue turns into a 2v4.",
    ],
    tournamentContext:
      "IGL calls shape BGMI matches every week — see how real teams handled theirs in the BGMI Tournament Hub standings and match results.",
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "final-circle",
    name: "Final Circle",
    tagline: "Win the last 60 seconds.",
    description: "Free BGMI endgame drill: positioning and utility use in final circles. Planned entry — not yet playable.",
    icon: "Flame",
    status: "planned",
    category: "practice",
    scenarioKind: "synthetic",
    ogMotif: "ENDGAME · BGMI LAB",
    methodology: "Planned drill covering spread, focus fire, and utility timing in final-zone scenarios.",
    instructions: ["Planned: endgame scenarios are being designed."],
    faqs: [{ question: "When will this drill be available?", answer: "It is planned. Circle IQ is the available drill today." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "zone-patterns",
    name: "Zone Pattern Explorer",
    tagline: "Explore what completed matches actually show.",
    description:
      "Zone Pattern Explorer is a free BGMI learning tool built on real published tournament results: filter completed matches by stage, map, day, and team, then read placement, finish, and point patterns. No signup, nothing saved.",
    icon: "Newspaper",
    status: "available",
    category: "learn",
    scenarioKind: "tournament-derived",
    answer:
      "Zone Pattern Explorer lets you filter completed BGMI tournament matches and read the patterns the published results show — winners, placement distribution, finishes, points, team consistency, and day progression. It uses match results only, not zone telemetry, and it does not predict future zones.",
    ogMotif: "PATTERNS · BGMI LAB",
    methodology:
      "The explorer reads a pinned static snapshot of three completed published stages (BMSD 2026 Grand Finals and Playoffs at source revision 720523, BGMI Showdown 2026 Grand Finals at 721716 — 54 completed matches, 16 results each). Filters scope the match sample: dataset, then map, then day. Every metric derives deterministically from the scoped match rows. Top-4 rate = appearances placed 1st–4th ÷ total appearances in the sample. Averages divide scoped totals by scoped appearances. The team table aggregates each team's scoped appearances and orders by average placement. Day and map views group the same scoped matches. Percentages always describe the visible sample, never future matches.",
    instructions: [
      "Pick a dataset: a completed tournament stage with its source revision shown.",
      "Narrow the sample with map, day, and team filters — watch the completed-match count.",
      "Read the pattern cards: winners, placement distribution, finishes and points, team consistency, day progression.",
      "Compare filters against each other instead of treating one view as a rule.",
      "Check the sample size and methodology before quoting any number.",
    ],
    examples: [
      "Example: BMSD 2026 Grand Finals — filter Erangel to see which teams won there and at what output.",
      "Example: compare Day 1 against Day 3 averages to see how output moved across a Finals weekend.",
    ],
    tournamentContext:
      "All numbers come from the published Tournament Hub record (tournament, stage, match, map, team, placement, finishes, points). The Hub has no zone telemetry — no circle positions, no rotation paths — so this explorer shows result patterns, not zone movement. Source revisions are shown with every view.",
    disclaimer:
      "Patterns describe the selected sample of completed matches only. Small samples are not general rules, and no pattern predicts future matches. Scoring formats vary by event — always check the official rulebook before a match.",
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
    faqs: [
      {
        question: "What is Zone Pattern Explorer?",
        answer:
          "Zone Pattern Explorer lets you filter completed BGMI tournament matches and read the patterns the published results show — winners, placement distribution, finishes, points, team consistency, and day progression.",
      },
      {
        question: "What data does Zone Pattern Explorer use?",
        answer:
          "A pinned snapshot of three completed published stages: BMSD 2026 Grand Finals and Playoffs (source revision 720523) and BGMI Showdown 2026 Grand Finals (721716) — 54 completed matches with full result tables. Every displayed number derives from those rows; filters only change which rows are included.",
      },
      {
        question: "Does it predict future BGMI zones?",
        answer:
          "No. It is an observational explorer, not a prediction tool: it shows what happened in recorded matches and never forecasts circles, rotations, or winners. The source contains no zone telemetry at all.",
      },
      {
        question: "How are the displayed patterns calculated?",
        answer:
          "Top-4 rate is appearances placed 1st–4th divided by total appearances in the visible sample; averages divide scoped totals by scoped appearances; the team table aggregates each team's scoped appearances and orders by average placement. The methodology section states every formula.",
      },
      {
        question: "Where can I see the full tournaments behind these numbers?",
        answer: "Browse the published stages in the Tournament Hub — standings, all matches, and source links.",
      },
    ],
  },
  {
    slug: "rotation-replay",
    name: "Rotation Replay",
    tagline: "Make the call, then see what actually happened.",
    description:
      "Rotation Replay is a free BGMI replay study built on real completed tournament matches: read a historical Finals context, make your tactical call, then compare it with the recorded outcome. No signup, no score saved.",
    icon: "History",
    status: "available",
    category: "learn",
    scenarioKind: "tournament-derived",
    scenarioRef: {
      tournamentSlug: "bmsd-2026",
      stageSlug: "grand-finals",
      sourceRevision: "720523",
    },
    answer:
      "Rotation Replay lets you make a tactical call in a tournament-derived scenario and then compare your decision with what actually happened in the recorded match. Five BMSD 2026 Grand Finals moments are included; each reveal separates the published facts from Lab-authored analysis. Nothing is predicted and no skill is rated.",
    shareText:
      "I compared my rotation calls against real BMSD 2026 Finals matches in Rotation Replay — a free BGMI replay study. Can you make the call?",
    ogMotif: "REPLAY · BGMI LAB",
    methodology:
      "Each replay pins a completed published match (BMSD 2026 Grand Finals, source revision 720523): match number, map, day, spotlight team, placement, finishes, and total points. You pick which approach you would prioritize from three options. The reveal states the recorded winner and the spotlight team's result, compares your priority with the outcome profile, and adds a Lab takeaway clearly labelled as analysis. A lined-up read means your priority matches the recorded outcome profile — it is not a correctness grade, an IGL rating, or a prediction.",
    instructions: [
      "Read the tournament context: Finals stage, match number, map, and day.",
      "Study the Lab scenario diagram and the spotlight team's position in the table race.",
      "Pick the approach you would prioritize — there is no correct answer, only your call.",
      "Read the reveal: the recorded outcome, how your priority compares, and the Lab takeaway.",
      "Finish all five replays to see your lined-up count, then share or replay freely.",
    ],
    examples: [
      "Example: Match 7 on Rondo — Team Tamilas banked 14 finishes but finished 4th, so the finishes-first call lines up with the recorded outcome even without the win.",
      "Example: Match 18 on Erangel — Gladiators won with 7 finishes while Rapid Chaos matched their 17 points from 4th, so the placement-first call lines up with the winning route.",
    ],
    tournamentContext:
      "All five replays resolve against the published BMSD 2026 Grand Finals (18 of 18 matches completed). Historical facts — tournament, stage, match, map, team, placement, finishes, points — come from the Tournament Hub record; the decision framing is authored by BGMI Lab.",
    disclaimer:
      "Reveals describe what happened, never what should have happened. Lab takeaways are analysis for learning and discussion, not historical claims about team intent. Scoring formats vary by event — always check the official rulebook before a match.",
    relatedHubHref: "/bgmi-tournaments/bmsd-2026/grand-finals",
    relatedSimulatorHref: "/bgmi-qualification",
    faqs: [
      {
        question: "What is BGMI Rotation Replay?",
        answer:
          "Rotation Replay lets you make a tactical call in a tournament-derived scenario and then compare your decision with what actually happened in the recorded match. Each of the five replays is pinned to a real BMSD 2026 Grand Finals match.",
      },
      {
        question: "How does Rotation Replay use tournament data?",
        answer:
          "Every replay reads published Tournament Hub facts — tournament, stage, match number, map, day, team, placement, finishes, and total points — recorded from source revision 720523. Anything beyond those facts, like why a team rotated, is never claimed; interpretation is labelled as Lab analysis.",
      },
      {
        question: "Does Rotation Replay predict what would happen in a real match?",
        answer:
          "No. It is a replay study, not a prediction tool: you react to a historical context and then see the recorded outcome. Nothing is predicted, no skill is rated, and no score is saved.",
      },
      {
        question: "What does my lined-up count measure?",
        answer:
          "It counts how many of your five priorities best describe the recorded outcome profile of each match — for example, picking finishes-first in a match the numbers show rewarded aggression. It does not measure correctness, IGL skill, or what any team intended.",
      },
      {
        question: "Where can I see the full tournament these replays come from?",
        answer: "Browse the published BMSD 2026 Grand Finals in the Tournament Hub — standings, all 18 matches, and source links.",
      },
    ],
  },
  {
    slug: "tournament-scenario-generator",
    name: "Tournament Scenario Generator",
    tagline: "Make the call on real Finals context.",
    description:
      "Tournament Scenario Generator is a free BGMI practice generator built on real completed tournament matches: read a recorded Finals context, make your tactical call, then compare it with the recorded outcome and learn the trade-off. No signup, no score saved.",
    icon: "ClipboardList",
    status: "available",
    category: "practice",
    scenarioKind: "tournament-derived",
    scenarioRef: {
      tournamentSlug: "bmsd-2026",
      stageSlug: "grand-finals",
      sourceRevision: "720523",
    },
    answer:
      "Tournament Scenario Generator creates practice scenarios from recorded tournament context: each scenario shows a real BMSD 2026 Grand Finals match setup and asks you to make a tactical call, then explains the trade-off behind your decision. It does not predict future matches and no skill is rated.",
    shareText:
      "I tested my tactical calls against real BMSD 2026 Finals context in Tournament Scenario Generator — a free BGMI practice tool. Can you make the call?",
    ogMotif: "SCENARIOS · BGMI LAB",
    methodology:
      "Each scenario pins a completed published match (BMSD 2026 Grand Finals, source revision 720523): match number, map, day, spotlight team, placement, finishes, and total points. You pick which approach you would prioritize from three options. The reveal states the recorded winner and the spotlight team's result, compares your priority with the outcome profile, and adds a Lab takeaway clearly labelled as analysis. A stronger practice read means your priority matches the recorded outcome profile — it is not a correctness grade, an IGL rating, or a prediction.",
    instructions: [
      "Read the recorded tournament context: Finals stage, match number, map, and day.",
      "Study the practice scenario frame and the spotlight team's position in the table race.",
      "Pick the approach you would prioritize — there is no correct answer, only your call.",
      "Read the reveal: the recorded outcome, how your priority compares, and why the scenario matters.",
      "Finish all six scenarios to see your stronger-read count, then share or generate again.",
    ],
    examples: [
      "Example: Match 6 on Erangel — Team Tamilas won with only 6 finishes, so the efficient-conversion call lines up with the recorded outcome.",
      "Example: Match 15 on Miramar — Orangutan peaked at 24 points while Gladiators blanked, so the steady-the-floor call lines up with the recorded lesson.",
    ],
    tournamentContext:
      "All six scenarios resolve against the published BMSD 2026 Grand Finals (18 of 18 matches completed). Historical facts — tournament, stage, match, map, team, placement, finishes, points — come from the Tournament Hub record; the decision framing is authored by BGMI Lab.",
    disclaimer:
      "Reveals describe what happened, never what should have happened. Lab takeaways are analysis for learning and discussion, not historical claims about team intent. Scoring formats vary by event — always check the official rulebook before a match.",
    relatedHubHref: "/bgmi-tournaments/bmsd-2026/grand-finals",
    relatedSimulatorHref: "/bgmi-qualification",
    faqs: [
      {
        question: "What is Tournament Scenario Generator?",
        answer:
          "Tournament Scenario Generator builds practice scenarios from recorded tournament context: each of the six scenarios shows a real BMSD 2026 Grand Finals match setup, asks you to make a tactical call, and then compares your decision with the recorded outcome.",
      },
      {
        question: "How does Tournament Scenario Generator use tournament data?",
        answer:
          "Every scenario reads published Tournament Hub facts — tournament, stage, match number, map, day, team, placement, finishes, and total points — recorded from source revision 720523. Anything beyond those facts, like why a team rotated, is never claimed; interpretation is labelled as Lab analysis.",
      },
      {
        question: "Does Tournament Scenario Generator predict future matches?",
        answer:
          "No. It is a practice generator, not a prediction tool: you react to a historical context and then see the recorded outcome. Nothing is predicted, no skill is rated, and no score is saved.",
      },
      {
        question: "What does my stronger-read count measure?",
        answer:
          "It counts how many of your six priorities best describe the recorded outcome profile of each scenario — for example, picking efficient conversion in a match the numbers show rewarded placement. It does not measure correctness, IGL skill, or what any team intended.",
      },
      {
        question: "How is this different from Rotation Replay?",
        answer:
          "Rotation Replay replays five recorded Finals moments and counts priorities that line up with the outcome. Tournament Scenario Generator frames six different matches as forward-looking practice scenarios with rationale notes on every option, so you learn the trade-off even before the reveal.",
      },
      {
        question: "Where can I see the full tournament these scenarios come from?",
        answer: "Browse the published BMSD 2026 Grand Finals in the Tournament Hub — standings, all 18 matches, and source links.",
      },
    ],
  },
  {
    slug: "loot-dash",
    name: "Loot Dash",
    tagline: "45 seconds of grab, dodge, and combo.",
    description:
      "Loot Dash is a free original MicroNest arcade game: steer through a tactical field for 45 seconds, grab supplies, dodge danger rings, and chain combos. Personal practice feedback only — no signup, nothing saved.",
    icon: "Trophy",
    status: "available",
    category: "fun",
    scenarioKind: "synthetic",
    answer:
      "Loot Dash is a free original MicroNest arcade game in BGMI Lab. You steer a marker through a field for 45 seconds, collecting supply, cache, and medkit tokens while avoiding danger rings. Pickups chained close together build a combo bonus; three ring hits ends the run early. Scores are personal practice feedback — not a skill rating — and nothing is saved.",
    shareText:
      "I ran Loot Dash — a free 45-second MicroNest arcade dash. Can you beat my route?",
    ogMotif: "LOOT DASH · BGMI LAB",
    methodology:
      "Each run lasts 45 seconds in a fixed 360 by 480 arena. Supplies are worth 10 points and caches 25. A medkit heals one hit and adds 5 points, or scores 15 points at full health. Consecutive pickups within 4 seconds raise a combo that adds 2 bonus points per step (a chained full-health medkit earns 15 plus the combo bonus); touching a danger ring resets the combo, costs one of 3 lives, and grants brief protection. Three hits ends the run early. Hazard count and drift speed ramp at 15 and 30 seconds. Layouts are seeded per run, so every attempt differs.",
    instructions: [
      "Press Start Run — steer with WASD, arrow keys, or by dragging on the arena (Space pauses).",
      "Collect supply, cache, and medkit tokens; chain pickups within 4 seconds to build a combo.",
      "Avoid the dashed danger rings — three hits ends the run early.",
      "Survive the 45 seconds, read your result, and press Play Again for a fresh seeded route.",
    ],
    faqs: [
      {
        question: "Is Loot Dash free?",
        answer: "Yes. Loot Dash is free to use with no signup and no saved score.",
      },
      {
        question: "How is my Loot Dash score calculated?",
        answer:
          "Supplies earn 10 points and caches 25. A medkit heals one hit and adds 5 points, or scores 15 points at full health (plus any combo bonus). Pickups chained within 4 seconds build a combo worth 2 bonus points per step. The score is ephemeral — nothing is saved and there is no leaderboard.",
      },
      {
        question: "Does Loot Dash predict real BGMI matches?",
        answer:
          "No. Loot Dash is an original arcade game with illustrative tokens and rings — it trains movement and timing, not zone prediction.",
      },
      {
        question: "Does Loot Dash rate my gaming skill?",
        answer:
          "No. The result (clean, steady, or messy run) is personal practice feedback about one 45-second route, not a skill rating or competitive claim.",
      },
      {
        question: "How is Loot Dash different from Circle IQ?",
        answer:
          "Circle IQ is a tactical decision drill — study a snapshot and commit to a rotation call. Loot Dash is a real-time arcade game — steer, collect, and dodge against the clock. Both are free and save nothing.",
      },
    ],
    examples: [
      "Example: chaining four supplies inside 4 seconds turns 40 points into 52 with the combo bonus.",
      "Example: grabbing a medkit after two hits restores a life, letting the run reach the full 45 seconds.",
    ],
    tournamentContext:
      "Looting routes and ring awareness decide BGMI tournament placements every week — see how real teams handle them in the BGMI Tournament Hub standings and match results.",
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "lift-the-trophy",
    name: "Lift the Trophy",
    tagline: "A light-hearted BGMI celebration.",
    description: "Free playful BGMI moment: lift the trophy after practice. Planned entry — not yet playable.",
    icon: "Flag",
    status: "planned",
    category: "fun",
    scenarioKind: "tournament-derived",
    ogMotif: "CHAMPIONS · BGMI LAB",
    methodology: "Planned celebration interaction — no scoring, no competition.",
    instructions: ["Planned: celebration interaction is being designed."],
    faqs: [{ question: "When will this be available?", answer: "It is planned. Circle IQ is the available drill today." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
];

export function getBgmiLabTool(slug: string): BgmiLabTool | null {
  return BGMI_LAB_TOOLS.find((t) => t.slug === slug) ?? null;
}

export function getAvailableBgmiLabTools(): BgmiLabTool[] {
  return BGMI_LAB_TOOLS.filter((t) => t.status === "available");
}

/**
 * Routable tools: "available" always; "experimental" only for testing new
 * mechanics (always noindex, never in sitemap). "planned" and "archived"
 * never resolve to routes.
 */
export function getRoutableBgmiLabTools(): BgmiLabTool[] {
  return BGMI_LAB_TOOLS.filter((t) => t.status === "available" || t.status === "experimental");
}

export function isLabSlugRoutable(slug: string): boolean {
  const tool = getBgmiLabTool(slug);
  return tool !== null && (tool.status === "available" || tool.status === "experimental");
}
