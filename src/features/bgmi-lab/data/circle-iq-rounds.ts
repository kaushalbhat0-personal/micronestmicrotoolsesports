/**
 * Circle IQ round bank — 8 authored synthetic practice scenarios.
 *
 * Pure data: no React, no state, no scoring, no imports. The island
 * component renders this; `circle-iq-logic.ts` holds the testable rules.
 *
 * Framing (do not weaken): these are illustrative tactical snapshots for
 * decision training. They do not reproduce BGMI map data, do not predict
 * real circles, and the principles are heuristics ("often", "tends to"),
 * never laws. Content tests pin this contract.
 *
 * Coordinate space: 360 × 240 viewBox shared with the island SVG.
 */

export type CircleIqLandmarkType = "ridge" | "compound" | "open" | "road" | "cover" | "water";

export interface CircleIqLandmark {
  readonly id: string;
  readonly label: string;
  readonly type: CircleIqLandmarkType;
  readonly x: number;
  readonly y: number;
}

export type CircleIqQuality = "strong" | "weak";

export type CircleIqRouteStyle = "covered" | "open" | "hold";

export interface CircleIqRoutePoint {
  readonly x: number;
  readonly y: number;
}

export interface CircleIqRoute {
  /** Covered = protected ground, open = exposed ground, hold = no advance. */
  readonly style: CircleIqRouteStyle;
  /** Polyline in the shared 360 × 240 diagram space. Hold routes stay in place. */
  readonly points: readonly CircleIqRoutePoint[];
  /** Honest one-line read of the line itself (never a result claim). */
  readonly caption: string;
}

export interface CircleIqOption {
  readonly id: string;
  readonly label: string;
  readonly quality: CircleIqQuality;
  /** Consequence-focused: why this call tends to work or fail HERE. */
  readonly explanation: string;
  /** Tactical overlay for preview + consequence visualization. */
  readonly route: CircleIqRoute;
}

export interface CircleIqRound {
  readonly id: string;
  readonly title: string;
  /** What is happening — enough context to decide without guessing. */
  readonly situation: string;
  /** The explicit decision question. */
  readonly question: string;
  readonly zone: { readonly center: { readonly x: number; readonly y: number }; readonly radius: number };
  readonly next: { readonly center: { readonly x: number; readonly y: number }; readonly radius: number };
  readonly player: { readonly x: number; readonly y: number };
  readonly landmarks: readonly CircleIqLandmark[];
  /** 2–3 options, exactly one strong. */
  readonly options: readonly CircleIqOption[];
  /** One transferable, hedged principle. */
  readonly principle: string;
}

export const CIRCLE_IQ_TOTAL = 8;

export const CIRCLE_IQ_ROUNDS: readonly CircleIqRound[] = [
  {
    id: "early-away-pull",
    title: "The early away-pull",
    situation:
      "The next circle pulls hard east across open ground. Your squad of four holds a compound on the west side with full utility. The north ridge offers covered movement toward the new zone; the direct middle route is short but completely open.",
    question: "The circle is pulling away from you. What is your call?",
    zone: { center: { x: 150, y: 125 }, radius: 100 },
    next: { center: { x: 238, y: 100 }, radius: 52 },
    player: { x: 82, y: 170 },
    landmarks: [
      { id: "compound", label: "Your compound", type: "compound", x: 82, y: 170 },
      { id: "ridge", label: "North ridge (cover)", type: "ridge", x: 165, y: 62 },
      { id: "field", label: "Open middle", type: "open", x: 165, y: 140 },
    ],
    options: [
      {
        id: "ridge-early",
        label: "Rotate early along the covered north side",
        quality: "strong",
        explanation:
          "Moving before the pull becomes urgent preserves more route options — the ridge hides the crossing and you arrive with time to pick positions.",
        route: {
          style: "covered",
          points: [
            { x: 82, y: 170 },
            { x: 120, y: 110 },
            { x: 165, y: 62 },
            { x: 238, y: 100 },
          ],
          caption: "Covered line — longer, hidden.",
        },
      },
      {
        id: "hold-compound",
        label: "Hold the compound until the last seconds",
        quality: "weak",
        explanation:
          "Holding spends your timing window. In this situation the late crossing runs open ground while other squads are already set and watching.",
        route: {
          style: "hold",
          points: [
            { x: 82, y: 170 },
            { x: 82, y: 170 },
          ],
          caption: "Hold — the timing window closes.",
        },
      },
      {
        id: "middle-late",
        label: "Drive straight across the open middle",
        quality: "weak",
        explanation:
          "The shortest path is the most exposed one. Crossing open ground late, without cover, is how squads in this spot tend to get wiped.",
        route: {
          style: "open",
          points: [
            { x: 82, y: 170 },
            { x: 130, y: 155 },
            { x: 165, y: 140 },
            { x: 200, y: 120 },
          ],
          caption: "Open line — shorter, exposed.",
        },
      },
    ],
    principle: "Rotating before the pull becomes urgent often preserves more route options.",
  },
  {
    id: "ridge-high-ground",
    title: "Ridge or dip",
    situation:
      "The next zone centers on a rocky ridge to the north-east. A low dip to the south is closer to your position but offers no cover and no sightlines. One squad is already fighting far to the west — they are unlikely to contest the ridge right now.",
    question: "Two paths lead into the zone. Which do you take?",
    zone: { center: { x: 170, y: 130 }, radius: 95 },
    next: { center: { x: 215, y: 85 }, radius: 50 },
    player: { x: 120, y: 195 },
    landmarks: [
      { id: "ridge", label: "Rocky ridge", type: "ridge", x: 215, y: 85 },
      { id: "dip", label: "Low dip (exposed)", type: "open", x: 150, y: 160 },
      { id: "fight", label: "Distant fight (west)", type: "cover", x: 45, y: 110 },
    ],
    options: [
      {
        id: "take-ridge",
        label: "Climb the ridge early and set up sightlines",
        quality: "strong",
        explanation:
          "High ground helps here because it improves visibility and route control — from the ridge you can watch both entries into the next zone.",
        route: {
          style: "covered",
          points: [
            { x: 120, y: 195 },
            { x: 170, y: 140 },
            { x: 215, y: 85 },
          ],
          caption: "High line — sightlines and control.",
        },
      },
      {
        id: "take-dip",
        label: "Slide into the closer low dip",
        quality: "weak",
        explanation:
          "Closer is not safer here. The dip gives up sightlines, so the next pull can force you to move blind while the ridge looks down on you.",
        route: {
          style: "open",
          points: [
            { x: 120, y: 195 },
            { x: 150, y: 160 },
          ],
          caption: "Low line — closer, blind.",
        },
      },
    ],
    principle: "High ground is valuable when it improves visibility and control of the next move.",
  },
  {
    id: "open-field-crossing",
    title: "Cover beats distance",
    situation:
      "A wide stretch of open field separates your squad from the next circle. A covered route along a tree line to the north is noticeably longer. You have two smokes and a buggy in driving condition.",
    question: "Short and exposed, or long and covered?",
    zone: { center: { x: 160, y: 120 }, radius: 95 },
    next: { center: { x: 235, y: 115 }, radius: 50 },
    player: { x: 70, y: 150 },
    landmarks: [
      { id: "trees", label: "Tree line (cover)", type: "cover", x: 150, y: 70 },
      { id: "field", label: "Open field", type: "open", x: 155, y: 145 },
      { id: "road", label: "Dirt road", type: "road", x: 150, y: 200 },
    ],
    options: [
      {
        id: "trees-long",
        label: "Take the longer tree-line route on foot",
        quality: "strong",
        explanation:
          "Cover can matter more than raw distance. The longer route keeps your squad alive and together, arriving ready to fight for positions.",
        route: {
          style: "covered",
          points: [
            { x: 70, y: 150 },
            { x: 110, y: 100 },
            { x: 150, y: 70 },
            { x: 235, y: 115 },
          ],
          caption: "Covered line — longer, together.",
        },
      },
      {
        id: "field-short",
        label: "Sprint straight across the open field",
        quality: "weak",
        explanation:
          "In this situation the short route crosses the maximum exposure with no fallback — one burst of fire can stop the whole rotation.",
        route: {
          style: "open",
          points: [
            { x: 70, y: 150 },
            { x: 155, y: 145 },
            { x: 235, y: 115 },
          ],
          caption: "Open line — short, no fallback.",
        },
      },
      {
        id: "buggy-open",
        label: "Drive the buggy across the open field",
        quality: "weak",
        explanation:
          "A vehicle here trades stealth for speed on the worst possible ground. Engine noise announces the crossing and the open field offers no bail-out cover.",
        route: {
          style: "open",
          points: [
            { x: 70, y: 150 },
            { x: 140, y: 160 },
            { x: 235, y: 115 },
          ],
          caption: "Fast line — loud, no bail-out.",
        },
      },
    ],
    principle: "Cover can matter more than raw distance when the timing difference is small.",
  },
  {
    id: "edge-rotation",
    title: "The quiet edge",
    situation:
      "The next circle is split: a strong compound sits north, already holding two squads, while the southern edge is quiet open slope with scattered rocks. Your squad is full strength with smokes to spare.",
    question: "Contested cover or quiet edge?",
    zone: { center: { x: 180, y: 120 }, radius: 95 },
    next: { center: { x: 185, y: 105 }, radius: 55 },
    player: { x: 90, y: 200 },
    landmarks: [
      { id: "compound", label: "North compound (2 squads)", type: "compound", x: 185, y: 55 },
      { id: "edge", label: "Quiet south edge", type: "cover", x: 175, y: 165 },
      { id: "slope", label: "Open slope", type: "open", x: 250, y: 170 },
    ],
    options: [
      {
        id: "south-edge",
        label: "Take the quiet south edge behind smokes",
        quality: "strong",
        explanation:
          "Contested cover often loses to numbers. A smoked edge entry keeps all four players alive for the next pull instead of trading lives for a compound.",
        route: {
          style: "covered",
          points: [
            { x: 90, y: 200 },
            { x: 130, y: 180 },
            { x: 175, y: 165 },
            { x: 185, y: 105 },
          ],
          caption: "Quiet edge — smoked, alive.",
        },
      },
      {
        id: "contest-north",
        label: "Contest the north compound head-on",
        quality: "weak",
        explanation:
          "Fighting uphill into two set squads before the circle shrinks tends to burn utility and players for a position you may still have to abandon.",
        route: {
          style: "open",
          points: [
            { x: 90, y: 200 },
            { x: 140, y: 120 },
            { x: 185, y: 55 },
          ],
          caption: "Contested line — uphill into two squads.",
        },
      },
    ],
    principle: "Edge positions can reduce threats from one direction — check the exit before committing.",
  },
  {
    id: "split-vs-regroup",
    title: "Split or regroup",
    situation:
      "Your squad is split: two players hold a ridge with good sightlines, two are stuck at a compound behind the zone. The next circle favors the ridge side. Regrouping now means giving up the ridge; staying split risks losing the compound pair during their rotation.",
    question: "Do you hold the split or regroup now?",
    zone: { center: { x: 175, y: 125 }, radius: 92 },
    next: { center: { x: 225, y: 90 }, radius: 50 },
    player: { x: 100, y: 180 },
    landmarks: [
      { id: "ridge", label: "Ridge pair", type: "ridge", x: 225, y: 90 },
      { id: "compound", label: "Compound pair (behind)", type: "compound", x: 100, y: 180 },
      { id: "gap", label: "Open gap between", type: "open", x: 160, y: 140 },
    ],
    options: [
      {
        id: "regroup-ridge",
        label: "Regroup on the ridge side now, together",
        quality: "strong",
        explanation:
          "The ridge side is where the next zone plays. Moving as four while the timing is calm usually beats a late rescue run across the open gap.",
        route: {
          style: "covered",
          points: [
            { x: 100, y: 180 },
            { x: 160, y: 140 },
            { x: 225, y: 90 },
          ],
          caption: "Together now — calm timing.",
        },
      },
      {
        id: "hold-split",
        label: "Hold the split for information and late picks",
        quality: "weak",
        explanation:
          "Splitting can create information, but here it risks the compound pair getting collapsed during their rotation — and a 2v4 rarely holds the ridge.",
        route: {
          style: "hold",
          points: [
            { x: 100, y: 180 },
            { x: 100, y: 180 },
          ],
          caption: "Hold split — a rescue run later.",
        },
      },
    ],
    principle: "Splitting can create information but may weaken the ability to survive a collapse.",
  },
  {
    id: "vehicle-timing",
    title: "When to drive",
    situation:
      "Your squad must cross a long road stretch to reach the next zone. You have a sturdy vehicle and full fuel. The zone edge is still far, but two squads are already posted on the far side of the road with sightlines on it.",
    question: "Drive now or drive later?",
    zone: { center: { x: 170, y: 125 }, radius: 95 },
    next: { center: { x: 240, y: 110 }, radius: 52 },
    player: { x: 80, y: 140 },
    landmarks: [
      { id: "road", label: "Long road crossing", type: "road", x: 160, y: 130 },
      { id: "posts", label: "Posted squads (far side)", type: "cover", x: 255, y: 110 },
      { id: "ditch", label: "Near-side ditch", type: "cover", x: 110, y: 170 },
    ],
    options: [
      {
        id: "drive-now",
        label: "Drive now while the far side is still settling",
        quality: "strong",
        explanation:
          "Vehicle timing can preserve flexibility. Going now, before the far squads are fully set, usually costs less than driving into prepared crossfire later.",
        route: {
          style: "covered",
          points: [
            { x: 80, y: 140 },
            { x: 160, y: 130 },
            { x: 240, y: 110 },
          ],
          caption: "Early crossing — less prepared fire.",
        },
      },
      {
        id: "drive-late",
        label: "Wait at the ditch, then drive at the last moment",
        quality: "weak",
        explanation:
          "Waiting gives the far side time to set crossfire on the only crossing. In this situation the late drive tends to arrive damaged and under fire.",
        route: {
          style: "open",
          points: [
            { x: 110, y: 170 },
            { x: 160, y: 130 },
            { x: 240, y: 110 },
          ],
          caption: "Late crossing — prepared crossfire.",
        },
      },
    ],
    principle: "Vehicle timing can preserve flexibility — early crossings often meet less prepared fire.",
  },
  {
    id: "late-rotation-pressure",
    title: "Already late",
    situation:
      "You waited too long and the zone is already closing. Your squad is caught halfway: a rock cluster sits 30 meters ahead inside the next circle, while your current ditch will be outside in seconds. Shots are coming from the east.",
    question: "The zone is moving and you are exposed. What now?",
    zone: { center: { x: 165, y: 120 }, radius: 90 },
    next: { center: { x: 215, y: 110 }, radius: 48 },
    player: { x: 140, y: 150 },
    landmarks: [
      { id: "rocks", label: "Rock cluster (in zone)", type: "cover", x: 215, y: 110 },
      { id: "ditch", label: "Current ditch (going out)", type: "open", x: 140, y: 150 },
      { id: "shots", label: "Shots from east", type: "ridge", x: 300, y: 130 },
    ],
    options: [
      {
        id: "commit-rocks",
        label: "Commit to the rock cluster now with smokes",
        quality: "strong",
        explanation:
          "When already late, committing to the nearest in-zone cover stops the bleeding. Hesitation here usually means taking zone damage and bullets at the same time.",
        route: {
          style: "covered",
          points: [
            { x: 140, y: 150 },
            { x: 180, y: 130 },
            { x: 215, y: 110 },
          ],
          caption: "Commit now — the bleeding stops.",
        },
      },
      {
        id: "hold-ditch",
        label: "Hold the ditch and heal through the edge",
        quality: "weak",
        explanation:
          "The ditch is going out of the zone — holding means fighting the clock, the damage, and the eastern shooters all at once.",
        route: {
          style: "hold",
          points: [
            { x: 140, y: 150 },
            { x: 140, y: 150 },
          ],
          caption: "Hold — clock, damage, and shots at once.",
        },
      },
      {
        id: "fight-east",
        label: "Turn and fight the eastern shooters first",
        quality: "weak",
        explanation:
          "Taking a fight while the zone closes behind you risks everything: even a won fight can leave the squad too damaged and too late to rotate.",
        route: {
          style: "open",
          points: [
            { x: 140, y: 150 },
            { x: 220, y: 140 },
            { x: 300, y: 130 },
          ],
          caption: "Fight first — the zone closes behind.",
        },
      },
    ],
    principle: "Late open crossings tend to increase exposure — committing to the nearest in-zone cover often stops the bleeding.",
  },
  {
    id: "final-safe-position",
    title: "The last sixty seconds",
    situation:
      "Final circle: five players left across three squads. A central rock offers the best position but is visible from two sides. A lone tree on the edge offers concealment with a narrow view. A shallow dip nearby hides you completely but you cannot see anything.",
    question: "Where do you play the final seconds?",
    zone: { center: { x: 180, y: 120 }, radius: 70 },
    next: { center: { x: 180, y: 120 }, radius: 30 },
    player: { x: 150, y: 150 },
    landmarks: [
      { id: "rock", label: "Central rock (visible)", type: "cover", x: 180, y: 120 },
      { id: "tree", label: "Edge tree (concealed)", type: "cover", x: 130, y: 165 },
      { id: "dip", label: "Blind dip", type: "open", x: 225, y: 160 },
    ],
    options: [
      {
        id: "edge-tree",
        label: "Play the edge tree — concealed, patient",
        quality: "strong",
        explanation:
          "In this final situation the concealed edge tends to outlast the exposed center: you stay hidden while the visible rock draws the other squads toward each other.",
        route: {
          style: "covered",
          points: [
            { x: 150, y: 150 },
            { x: 130, y: 165 },
          ],
          caption: "Concealed edge — patient.",
        },
      },
      {
        id: "central-rock",
        label: "Take the central rock and control the circle",
        quality: "weak",
        explanation:
          "The center looks strongest but here it is visible from two sides — holding it often means fighting both remaining squads instead of letting them meet.",
        route: {
          style: "open",
          points: [
            { x: 150, y: 150 },
            { x: 180, y: 120 },
          ],
          caption: "Exposed center — two sides watch.",
        },
      },
      {
        id: "blind-dip",
        label: "Hide in the blind dip and wait",
        quality: "weak",
        explanation:
          "Total concealment with zero information is a gamble: without sightlines the final pull can force a blind move at the worst moment.",
        route: {
          style: "open",
          points: [
            { x: 150, y: 150 },
            { x: 225, y: 160 },
          ],
          caption: "Blind hide — no sightlines.",
        },
      },
    ],
    principle: "In final circles, concealment often outlasts exposed control — let others meet first.",
  },
];
