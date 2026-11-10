/**
 * Circle IQ round bank — 8 authored synthetic practice scenarios (V4).
 *
 * Pure data: no React, no state, no scoring, no imports. The island
 * component renders this; `circle-iq-logic.ts` holds the testable rules.
 *
 * Framing (do not weaken): these are illustrative tactical snapshots for
 * decision training. They do not reproduce BGMI map data, do not predict
 * real circles, and the principles are heuristics ("often", "tends to"),
 * never laws. Content tests pin this contract.
 *
 * V4 information design: situation + option labels + preview captions are
 * NEUTRAL geometry. They never grade a route (no covered/open/safer/
 * risky/strong/weak/best/exposed language). Quality is revealed only
 * through the authored consequence + explanation after COMMIT. Facts the
 * player must interpret live in `reveals` (2 scouts per round).
 *
 * Coordinate space: 360 × 240 viewBox shared with the island SVG.
 *
 * V5 Hybrid: every move option carries ~2 authored crossing points. The
 * player first selects a corridor, then decides WHERE along it to cross.
 * Hold options carry no crossings. Exposure is authored per crossing and
 * never displayed before commit; scoring stays ID-based on the parent
 * option.
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
  /** NEUTRAL geometry read (never a quality grade, never a result claim). */
  readonly caption: string;
}

export interface CircleIqCrossing {
  /** Stable per-option id, e.g. "r1-ridge-early-a". Unique within its round. */
  readonly id: string;
  /** Neutral terrain name shown in the crossing list (never a grade). */
  readonly label: string;
  /** Factual intel — terrain facts only, never a verdict or quality grade. */
  readonly intel: string;
  /** Pin placement in the shared 360 × 240 diagram space, on/near its corridor. */
  readonly x: number;
  readonly y: number;
  /** Authored arrival coordinate in the shared 360 × 240 space. */
  readonly arrival: {
    readonly x: number;
    readonly y: number;
  };
  /** Authored exposure class. Internal only — never displayed before commit. */
  readonly exposure: "low" | "high";
  /** Authored consequence note, revealed only after commit. */
  readonly note: string;
}

export interface CircleIqOption {
  readonly id: string;
  readonly label: string;
  readonly quality: CircleIqQuality;
  /** Consequence-focused: why this call tends to work or fail HERE. */
  readonly explanation: string;
  /** Tactical overlay for preview + consequence visualization. */
  readonly route: CircleIqRoute;
  /**
   * V5 Hybrid: authored crossing points for this corridor. Move options
   * carry 2; hold options carry none (Hold skips straight to Preview).
   */
  readonly crossings?: readonly CircleIqCrossing[];
}

export type CircleIqRevealKind = "landmark" | "route" | "threat";

export interface CircleIqReveal {
  /** Stable per-round id, e.g. "r1-ridge". Unique within its round. */
  readonly id: string;
  readonly kind: CircleIqRevealKind;
  /** Must match a landmark id OR an option id in the same round. */
  readonly targetId: string;
  /** Short title shown on the inspect control. */
  readonly title: string;
  /** Concise intel — facts only, never a verdict, score, or quality grade. */
  readonly intel: string;
  /** Map placement in the shared 360 × 240 diagram space. */
  readonly x: number;
  readonly y: number;
}

export interface CircleIqRound {
  readonly id: string;
  readonly title: string;
  /** Neutral context — enough to decide without grading any route. */
  readonly situation: string;
  /** The explicit decision question. */
  readonly question: string;
  readonly zone: { readonly center: { readonly x: number; readonly y: number }; readonly radius: number };
  readonly next: { readonly center: { readonly x: number; readonly y: number }; readonly radius: number };
  readonly player: { readonly x: number; readonly y: number };
  readonly landmarks: readonly CircleIqLandmark[];
  /** 2–3 options, exactly one strong. Labels are neutral geometry. */
  readonly options: readonly CircleIqOption[];
  /** 3–4 inspectable targets per round (scout budget: 2). */
  readonly reveals: readonly CircleIqReveal[];
  /** One transferable, hedged principle. */
  readonly principle: string;
}

export const CIRCLE_IQ_TOTAL = 8;

export const CIRCLE_IQ_ROUNDS: readonly CircleIqRound[] = [
  {
    id: "early-away-pull",
    title: "The early away-pull",
    situation:
      "The next circle pulls hard east. Your squad of four holds a compound on the west side with full utility. A northern ridge runs toward the new zone; the middle ground is the shorter line.",
    question: "The circle is pulling away from you. What is your call?",
    zone: { center: { x: 150, y: 125 }, radius: 100 },
    next: { center: { x: 238, y: 100 }, radius: 52 },
    player: { x: 82, y: 170 },
    landmarks: [
      { id: "compound", label: "Your compound", type: "compound", x: 82, y: 170 },
      { id: "ridge", label: "North ridge", type: "ridge", x: 165, y: 62 },
      { id: "field", label: "Middle ground", type: "open", x: 165, y: 140 },
    ],
    options: [
      {
        id: "ridge-early",
        label: "Rotate early via the northern ridge",
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
          caption: "Northern line via the ridge into NEXT.",
        },
        crossings: [
          {
            id: "r1-ridge-early-a",
            label: "North hollow",
            intel: "Hollow below the ridge crest on the north line.",
            x: 118,
            y: 112,
            arrival: { x: 200, y: 80 },
            exposure: "low",
            note: "The hollow keeps the ridge between you and the far side through the crossing.",
          },
          {
            id: "r1-ridge-early-b",
            label: "Ridge crest",
            intel: "Crest of the ridge where the line turns east toward NEXT.",
            x: 184,
            y: 76,
            arrival: { x: 238, y: 100 },
            exposure: "high",
            note: "Crossing the crest draws fire from the east and costs extra meds on arrival.",
          },
        ],
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
          caption: "Holds at the compound.",
        },
      },
      {
        id: "middle-late",
        label: "Drive straight across the middle ground",
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
          caption: "Middle line straight into NEXT.",
        },
        crossings: [
          {
            id: "r1-middle-late-a",
            label: "Field notch",
            intel: "Notch in the field wall along the middle line.",
            x: 130,
            y: 156,
            arrival: { x: 200, y: 120 },
            exposure: "high",
            note: "The notch sits in view of the far side and the squad arrives split.",
          },
          {
            id: "r1-middle-late-b",
            label: "Field saddle",
            intel: "Low saddle where the middle line meets the far slope.",
            x: 186,
            y: 128,
            arrival: { x: 190, y: 130 },
            exposure: "high",
            note: "The saddle crossing meets prepared fire and the arrival falls short of NEXT.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r1-ridge",
        kind: "landmark",
        targetId: "ridge",
        title: "North ridge",
        intel: "The ridge runs toward NEXT. The crest overlooks the crossing and is visible from the east.",
        x: 165,
        y: 62,
      },
      {
        id: "r1-middle",
        kind: "landmark",
        targetId: "field",
        title: "Middle ground",
        intel: "Straight line of about 90 m to NEXT. No standing trees or rocks marked on this stretch.",
        x: 165,
        y: 140,
      },
      {
        id: "r1-compound",
        kind: "landmark",
        targetId: "compound",
        title: "Your compound",
        intel: "Four up with full utility. Leaving now keeps the timing window wide; the crossing gets watched the longer you wait.",
        x: 82,
        y: 170,
      },
      {
        id: "r1-farside",
        kind: "threat",
        targetId: "middle-late",
        title: "Far-side squads",
        intel: "Two squads were last seen settling near NEXT. Movement across the middle is visible from that side.",
        x: 238,
        y: 100,
      },
    ],
    principle: "Rotating before the pull becomes urgent often preserves more route options.",
  },
  {
    id: "ridge-high-ground",
    title: "Ridge or dip",
    situation:
      "The next zone centers on a rocky ridge to the north-east. A low dip to the south sits closer to your position. One squad is fighting far to the west.",
    question: "Two paths lead into the zone. Which do you take?",
    zone: { center: { x: 170, y: 130 }, radius: 95 },
    next: { center: { x: 215, y: 85 }, radius: 50 },
    player: { x: 120, y: 195 },
    landmarks: [
      { id: "ridge", label: "Rocky ridge", type: "ridge", x: 215, y: 85 },
      { id: "dip", label: "Low dip", type: "open", x: 150, y: 160 },
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
          caption: "Northern line to the ridge and into NEXT.",
        },
        crossings: [
          {
            id: "r2-take-ridge-a",
            label: "Low slope",
            intel: "Lower slope on the ridge line with rock steps underfoot.",
            x: 128,
            y: 186,
            arrival: { x: 215, y: 85 },
            exposure: "low",
            note: "The slope keeps the climb steady and the squad arrives together.",
          },
          {
            id: "r2-take-ridge-b",
            label: "Ridge lip",
            intel: "Lip of the ridge where the climb levels before NEXT.",
            x: 194,
            y: 110,
            arrival: { x: 225, y: 95 },
            exposure: "high",
            note: "The lip is watched from the far buildings and the squad arrives needing meds.",
          },
        ],
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
          caption: "Southern line to the dip.",
        },
        crossings: [
          {
            id: "r2-take-dip-a",
            label: "Dip mouth",
            intel: "Mouth of the dip where the ground drops from the approach.",
            x: 134,
            y: 180,
            arrival: { x: 150, y: 160 },
            exposure: "high",
            note: "The mouth faces the ridge and the pair arrives pinned.",
          },
          {
            id: "r2-take-dip-b",
            label: "Dip wall",
            intel: "Wall of the dip past the floor on the far side.",
            x: 168,
            y: 172,
            arrival: { x: 162, y: 168 },
            exposure: "high",
            note: "The floor blocks sightlines both ways and the next pull forces a blind climb.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r2-ridge",
        kind: "landmark",
        targetId: "ridge",
        title: "Rocky ridge",
        intel: "High ground above NEXT. From the crest you can watch both entries; the climb is uphill for about 20 m.",
        x: 215,
        y: 85,
      },
      {
        id: "r2-dip",
        kind: "landmark",
        targetId: "dip",
        title: "Low dip",
        intel: "Closest ground, about 40 m. The dip blocks sightlines both ways — you cannot see out until you climb.",
        x: 150,
        y: 160,
      },
      {
        id: "r2-fight",
        kind: "threat",
        targetId: "fight",
        title: "Distant fight",
        intel: "Shots far to the west, outside the next zone. That squad has not moved toward the ridge.",
        x: 45,
        y: 110,
      },
      {
        id: "r2-approach",
        kind: "route",
        targetId: "take-ridge",
        title: "Ridge approach",
        intel: "The ridge approach crosses mid ground, then climbs. The last 30 m rise above the surrounding dips.",
        x: 170,
        y: 140,
      },
    ],
    principle: "High ground is valuable when it improves visibility and control of the next move.",
  },
  {
    id: "open-field-crossing",
    title: "Field crossing",
    situation:
      "A wide stretch of field separates your squad from the next circle. A tree line to the north runs parallel to the zone. You have two smokes and a buggy in driving condition.",
    question: "Short and direct, or long around the side?",
    zone: { center: { x: 160, y: 120 }, radius: 95 },
    next: { center: { x: 235, y: 115 }, radius: 50 },
    player: { x: 70, y: 150 },
    landmarks: [
      { id: "trees", label: "Tree line", type: "cover", x: 150, y: 70 },
      { id: "field", label: "Wide field", type: "open", x: 155, y: 145 },
      { id: "road", label: "Dirt road", type: "road", x: 150, y: 200 },
    ],
    options: [
      {
        id: "trees-long",
        label: "Take the tree-line route on foot",
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
          caption: "Northern line via the tree line into NEXT.",
        },
        crossings: [
          {
            id: "r3-trees-long-a",
            label: "Outer trees",
            intel: "Outer trees where the line leaves the start toward the bend.",
            x: 90,
            y: 125,
            arrival: { x: 235, y: 115 },
            exposure: "low",
            note: "The bend breaks sight from the compound and the squad arrives together.",
          },
          {
            id: "r3-trees-long-b",
            label: "East tree gap",
            intel: "Gap between the last trees and the edge of NEXT.",
            x: 192,
            y: 92,
            arrival: { x: 226, y: 124 },
            exposure: "high",
            note: "The gap is watched from the road and the squad arrives needing meds.",
          },
        ],
      },
      {
        id: "field-short",
        label: "Sprint straight across the middle field",
        quality: "weak",
        explanation:
          "In this situation the short route crosses the maximum distance with no fallback — one burst of fire can stop the whole rotation.",
        route: {
          style: "open",
          points: [
            { x: 70, y: 150 },
            { x: 155, y: 145 },
            { x: 235, y: 115 },
          ],
          caption: "Middle line straight across the field.",
        },
        crossings: [
          {
            id: "r3-field-short-a",
            label: "West furrow",
            intel: "Furrow across the west half of the field on the middle line.",
            x: 112,
            y: 148,
            arrival: { x: 200, y: 130 },
            exposure: "high",
            note: "The furrow offers no break from view and the crossing meets fire halfway.",
          },
          {
            id: "r3-field-short-b",
            label: "Far furrow",
            intel: "Second furrow near the far side of the field before NEXT.",
            x: 195,
            y: 130,
            arrival: { x: 188, y: 138 },
            exposure: "high",
            note: "The far furrow is watched from both sides and the arrival falls outside NEXT.",
          },
        ],
      },
      {
        id: "buggy-open",
        label: "Drive the buggy across the middle field",
        quality: "weak",
        explanation:
          "A vehicle here trades stealth for speed on the worst possible ground. Engine noise announces the crossing and the field offers no bail-out.",
        route: {
          style: "open",
          points: [
            { x: 70, y: 150 },
            { x: 140, y: 160 },
            { x: 235, y: 115 },
          ],
          caption: "Middle line by vehicle across the field.",
        },
        crossings: [
          {
            id: "r3-buggy-open-a",
            label: "Track bend",
            intel: "Bend in the dirt track where the vehicle line turns east.",
            x: 105,
            y: 156,
            arrival: { x: 200, y: 135 },
            exposure: "high",
            note: "Engine sound carries across the field and the squad arrives loud.",
          },
          {
            id: "r3-buggy-open-b",
            label: "Track ditch",
            intel: "Ditch beside the track halfway across the field.",
            x: 138,
            y: 163,
            arrival: { x: 210, y: 128 },
            exposure: "high",
            note: "The ditch cannot hide a vehicle and the crossing meets fire from the road.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r3-trees",
        kind: "landmark",
        targetId: "trees",
        title: "Tree line",
        intel: "Standing trees run most of the way toward NEXT. The line measures about 60 m longer than the direct field crossing.",
        x: 150,
        y: 70,
      },
      {
        id: "r3-field",
        kind: "landmark",
        targetId: "field",
        title: "Wide field",
        intel: "About 110 m of low grass to NEXT. No rocks or dips marked on this stretch.",
        x: 155,
        y: 145,
      },
      {
        id: "r3-road",
        kind: "landmark",
        targetId: "road",
        title: "Dirt road",
        intel: "Runs south of your position, outside the next zone. Engine sound carries across the field from here.",
        x: 150,
        y: 200,
      },
      {
        id: "r3-crossing",
        kind: "route",
        targetId: "trees-long",
        title: "Tree-line crossing",
        intel: "The tree line bends around the west side before turning east. A full squad can move it together without splitting.",
        x: 110,
        y: 100,
      },
    ],
    principle: "Cover can matter more than raw distance when the timing difference is small.",
  },
  {
    id: "edge-rotation",
    title: "Edge or compound",
    situation:
      "The next circle is split: a compound sits north with two squads inside, while the southern edge is slope with scattered rocks. Your squad is at full strength with smokes to spare.",
    question: "Contested compound or southern edge?",
    zone: { center: { x: 180, y: 120 }, radius: 95 },
    next: { center: { x: 185, y: 105 }, radius: 55 },
    player: { x: 90, y: 200 },
    landmarks: [
      { id: "compound", label: "North compound", type: "compound", x: 185, y: 55 },
      { id: "edge", label: "South edge", type: "cover", x: 175, y: 165 },
      { id: "slope", label: "East slope", type: "open", x: 250, y: 170 },
    ],
    options: [
      {
        id: "south-edge",
        label: "Take the south edge behind smokes",
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
          caption: "Southern line via the south edge into NEXT.",
        },
        crossings: [
          {
            id: "r4-south-edge-a",
            label: "Rock step",
            intel: "Step of rocks on the south entry about halfway to NEXT.",
            x: 110,
            y: 190,
            arrival: { x: 185, y: 105 },
            exposure: "low",
            note: "The rocks break the sightline along the entry and the squad arrives together.",
          },
          {
            id: "r4-south-edge-b",
            label: "Edge rise",
            intel: "Rise where the south edge levels into NEXT.",
            x: 180,
            y: 138,
            arrival: { x: 183, y: 120 },
            exposure: "high",
            note: "The rise is watched from the compound windows and the squad arrives needing smokes.",
          },
        ],
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
          caption: "Northern line to the compound.",
        },
        crossings: [
          {
            id: "r4-contest-north-a",
            label: "Gate approach",
            intel: "Approach to the compound gate facing south.",
            x: 140,
            y: 122,
            arrival: { x: 185, y: 60 },
            exposure: "high",
            note: "The gate faces two set squads and the squad arrives under fire.",
          },
          {
            id: "r4-contest-north-b",
            label: "Compound wall",
            intel: "Wall corner on the west side of the compound.",
            x: 162,
            y: 87,
            arrival: { x: 176, y: 52 },
            exposure: "high",
            note: "The wall is pre-aimed from inside and the crossing stalls at the corner.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r4-compound",
        kind: "landmark",
        targetId: "compound",
        title: "North compound",
        intel: "Two squads inside with walls and windows on the approach. The gate faces south toward your side.",
        x: 185,
        y: 55,
      },
      {
        id: "r4-edge",
        kind: "landmark",
        targetId: "edge",
        title: "South edge",
        intel: "Slope with scattered rocks up to NEXT. Smokes stretch about 30 m across the entry from the west.",
        x: 175,
        y: 165,
      },
      {
        id: "r4-entry",
        kind: "route",
        targetId: "south-edge",
        title: "South entry",
        intel: "The south entry rises gently into NEXT. Rocks break the sightline every 15–20 m along the last stretch.",
        x: 130,
        y: 180,
      },
    ],
    principle: "Edge positions can reduce threats from one direction — check the exit before committing.",
  },
  {
    id: "split-vs-regroup",
    title: "Split or regroup",
    situation:
      "Your squad is split: two players hold a ridge, two are at a compound behind the current zone. The next circle sits on the ridge side. The gap between the pairs is about 80 m of low ground.",
    question: "Do you hold the split or regroup now?",
    zone: { center: { x: 175, y: 125 }, radius: 92 },
    next: { center: { x: 225, y: 90 }, radius: 50 },
    player: { x: 100, y: 180 },
    landmarks: [
      { id: "ridge", label: "Ridge pair", type: "ridge", x: 225, y: 90 },
      { id: "compound", label: "Compound pair", type: "compound", x: 100, y: 180 },
      { id: "gap", label: "Middle gap", type: "open", x: 160, y: 140 },
    ],
    options: [
      {
        id: "regroup-ridge",
        label: "Regroup on the ridge side now, together",
        quality: "strong",
        explanation:
          "The ridge side is where the next zone plays. Moving as four while the timing is calm usually beats a late rescue run across the gap.",
        route: {
          style: "covered",
          points: [
            { x: 100, y: 180 },
            { x: 160, y: 140 },
            { x: 225, y: 90 },
          ],
          caption: "Middle line from the compound to the ridge.",
        },
        crossings: [
          {
            id: "r5-regroup-ridge-a",
            label: "Gap hollow",
            intel: "Hollow in the low ground between the pairs.",
            x: 130,
            y: 160,
            arrival: { x: 225, y: 90 },
            exposure: "low",
            note: "The hollow sits below the sightlines and the pair crosses calmly.",
          },
          {
            id: "r5-regroup-ridge-b",
            label: "Ridge foot",
            intel: "Foot of the ridge where the gap meets the climb.",
            x: 192,
            y: 115,
            arrival: { x: 216, y: 99 },
            exposure: "high",
            note: "The foot is watched from the far side and the pair arrives needing meds.",
          },
        ],
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
          caption: "Holds the split positions.",
        },
      },
    ],
    reveals: [
      {
        id: "r5-ridge",
        kind: "landmark",
        targetId: "ridge",
        title: "Ridge pair",
        intel: "Two players above NEXT with sightlines on both entries. They hold smokes and full health.",
        x: 225,
        y: 90,
      },
      {
        id: "r5-compound",
        kind: "landmark",
        targetId: "compound",
        title: "Compound pair",
        intel: "Two players behind the current zone edge. Their move to the ridge is about 80 m across low ground.",
        x: 100,
        y: 180,
      },
      {
        id: "r5-gap",
        kind: "route",
        targetId: "regroup-ridge",
        title: "Gap crossing",
        intel: "The gap runs uphill toward the ridge. Crossing now meets little movement; each minute the far side settles further.",
        x: 160,
        y: 140,
      },
    ],
    principle: "Splitting can create information but may weaken the ability to survive a collapse.",
  },
  {
    id: "vehicle-timing",
    title: "When to drive",
    situation:
      "Your squad must cross a long road stretch to reach the next zone. You have a sturdy vehicle and full fuel. The zone edge is still far, and two squads are posted on the far side of the road.",
    question: "Drive now or drive later?",
    zone: { center: { x: 170, y: 125 }, radius: 95 },
    next: { center: { x: 240, y: 110 }, radius: 52 },
    player: { x: 80, y: 140 },
    landmarks: [
      { id: "road", label: "Road crossing", type: "road", x: 160, y: 130 },
      { id: "posts", label: "Far-side squads", type: "cover", x: 255, y: 110 },
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
          caption: "Road crossing now into NEXT.",
        },
        crossings: [
          {
            id: "r6-drive-now-a",
            label: "Road ditch",
            intel: "Ditch on the near side of the road crossing.",
            x: 120,
            y: 135,
            arrival: { x: 240, y: 110 },
            exposure: "low",
            note: "The ditch hides the dismount and the squad crosses before the far side settles.",
          },
          {
            id: "r6-drive-now-b",
            label: "Far verge",
            intel: "Verge on the far side of the road before NEXT.",
            x: 200,
            y: 120,
            arrival: { x: 230, y: 120 },
            exposure: "high",
            note: "The verge is watched once the far squads stop moving and the vehicle arrives damaged.",
          },
        ],
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
          caption: "Waits at the ditch, then crosses the road.",
        },
        crossings: [
          {
            id: "r6-drive-late-a",
            label: "Ditch mouth",
            intel: "Mouth of the near-side ditch facing the road.",
            x: 135,
            y: 150,
            arrival: { x: 220, y: 118 },
            exposure: "high",
            note: "Waiting lets the far side set crossfire and the late drive arrives damaged.",
          },
          {
            id: "r6-drive-late-b",
            label: "Road middle",
            intel: "Middle of the road on the only crossing line.",
            x: 186,
            y: 124,
            arrival: { x: 215, y: 120 },
            exposure: "high",
            note: "The middle of the road is pre-aimed and the crossing stalls under fire.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r6-road",
        kind: "landmark",
        targetId: "road",
        title: "Road crossing",
        intel: "About 100 m of road with ditches on both sides. A vehicle crosses in roughly 15 seconds.",
        x: 160,
        y: 130,
      },
      {
        id: "r6-posts",
        kind: "threat",
        targetId: "posts",
        title: "Far-side squads",
        intel: "Two squads near NEXT, still moving between buildings. Their view of the road sharpens once they stop moving.",
        x: 255,
        y: 110,
      },
      {
        id: "r6-ditch",
        kind: "landmark",
        targetId: "ditch",
        title: "Near-side ditch",
        intel: "Low ground short of the road, outside NEXT. It hides a parked vehicle but not a crossing.",
        x: 110,
        y: 170,
      },
    ],
    principle: "Vehicle timing can preserve flexibility — early crossings often meet less prepared fire.",
  },
  {
    id: "late-rotation-pressure",
    title: "Already late",
    situation:
      "The zone is closing. Your squad is halfway: a rock cluster sits 30 meters ahead inside the next circle, while your current ditch falls outside in seconds. Shots are coming from the east.",
    question: "The zone is moving and you are mid-ground. What now?",
    zone: { center: { x: 165, y: 120 }, radius: 90 },
    next: { center: { x: 215, y: 110 }, radius: 48 },
    player: { x: 140, y: 150 },
    landmarks: [
      { id: "rocks", label: "Rock cluster", type: "cover", x: 215, y: 110 },
      { id: "ditch", label: "Current ditch", type: "open", x: 140, y: 150 },
      { id: "shots", label: "Shots from east", type: "ridge", x: 300, y: 130 },
    ],
    options: [
      {
        id: "commit-rocks",
        label: "Commit to the rock cluster now with smokes",
        quality: "strong",
        explanation:
          "When already late, committing to the nearest in-zone spot stops the bleeding. Hesitation here usually means taking zone damage and bullets at the same time.",
        route: {
          style: "covered",
          points: [
            { x: 140, y: 150 },
            { x: 180, y: 130 },
            { x: 215, y: 110 },
          ],
          caption: "Short move to the rock cluster.",
        },
        crossings: [
          {
            id: "r7-commit-rocks-a",
            label: "Smoke hollow",
            intel: "Hollow between the ditch and the rocks, about 15 m out.",
            x: 160,
            y: 140,
            arrival: { x: 215, y: 110 },
            exposure: "low",
            note: "Smokes hold across the hollow and the squad reaches the rocks together.",
          },
          {
            id: "r7-commit-rocks-b",
            label: "Rock notch",
            intel: "Notch at the near edge of the rock cluster.",
            x: 199,
            y: 122,
            arrival: { x: 206, y: 117 },
            exposure: "high",
            note: "The notch faces the eastern shooters and the squad arrives needing meds.",
          },
        ],
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
          caption: "Holds the ditch.",
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
          caption: "Moves east toward the shots.",
        },
        crossings: [
          {
            id: "r7-fight-east-a",
            label: "East dip",
            intel: "Dip on the line toward the eastern shots.",
            x: 196,
            y: 143,
            arrival: { x: 262, y: 138 },
            exposure: "high",
            note: "The dip leads away from NEXT and the zone closes behind the squad.",
          },
          {
            id: "r7-fight-east-b",
            label: "Far track",
            intel: "Track far to the east near the shooters.",
            x: 260,
            y: 135,
            arrival: { x: 278, y: 132 },
            exposure: "high",
            note: "The track ends at the shooters while the zone leaves the squad behind.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r7-rocks",
        kind: "landmark",
        targetId: "rocks",
        title: "Rock cluster",
        intel: "Rocks inside NEXT, about 30 m ahead. The cluster breaks sightlines from the east once you arrive.",
        x: 215,
        y: 110,
      },
      {
        id: "r7-ditch",
        kind: "landmark",
        targetId: "ditch",
        title: "Current ditch",
        intel: "Low ground that falls outside NEXT in seconds. Staying means healing while the zone counts down.",
        x: 140,
        y: 150,
      },
      {
        id: "r7-shots",
        kind: "threat",
        targetId: "shots",
        title: "Eastern shooters",
        intel: "A squad firing from the east edge. They hold the angle on the ditch but not on the rock cluster.",
        x: 300,
        y: 130,
      },
      {
        id: "r7-crossing",
        kind: "route",
        targetId: "commit-rocks",
        title: "Ditch-to-rocks move",
        intel: "Thirty meters uphill with two smokes in hand. The ditch-to-rock line faces away from the eastern shots.",
        x: 180,
        y: 130,
      },
    ],
    principle: "Late moves into the nearest in-zone spot often stop the bleeding — check the clock first.",
  },
  {
    id: "final-safe-position",
    title: "The last sixty seconds",
    situation:
      "Final circle: five players left across three squads. A central rock sits in the middle with sightlines both ways. A lone tree stands on the edge. A shallow dip nearby blocks sightlines in and out.",
    question: "Where do you play the final seconds?",
    zone: { center: { x: 180, y: 120 }, radius: 70 },
    next: { center: { x: 180, y: 120 }, radius: 30 },
    player: { x: 150, y: 150 },
    landmarks: [
      { id: "rock", label: "Central rock", type: "cover", x: 180, y: 120 },
      { id: "tree", label: "Edge tree", type: "cover", x: 158, y: 138 },
      { id: "dip", label: "Shallow dip", type: "open", x: 225, y: 160 },
    ],
    options: [
      {
        id: "edge-tree",
        label: "Play the edge tree and wait",
        quality: "strong",
        explanation:
          "In this final situation the concealed edge tends to outlast the middle: you stay hidden while the central rock draws the other squads toward each other.",
        route: {
          style: "covered",
          points: [
            { x: 150, y: 150 },
            { x: 158, y: 138 },
          ],
          caption: "Short move to the edge tree.",
        },
        crossings: [
          {
            id: "r8-edge-tree-a",
            label: "West step",
            intel: "Step of ground west of the tree on the short line.",
            x: 138,
            y: 150,
            arrival: { x: 158, y: 138 },
            exposure: "low",
            note: "The step stays out of the middle and the squad waits unseen.",
          },
          {
            id: "r8-edge-tree-b",
            label: "South fold",
            intel: "Fold in the ground south of the tree line.",
            x: 168,
            y: 162,
            arrival: { x: 170, y: 140 },
            exposure: "high",
            note: "The fold climbs into view of the middle and the squad arrives watched.",
          },
        ],
      },
      {
        id: "central-rock",
        label: "Take the central rock",
        quality: "weak",
        explanation:
          "The middle looks tempting but here it is visible from two sides — holding it often means fighting both remaining squads instead of letting them meet.",
        route: {
          style: "open",
          points: [
            { x: 150, y: 150 },
            { x: 180, y: 120 },
          ],
          caption: "Short move to the central rock.",
        },
        crossings: [
          {
            id: "r8-central-rock-a",
            label: "South step",
            intel: "Step of ground south of the middle line.",
            x: 168,
            y: 160,
            arrival: { x: 178, y: 122 },
            exposure: "high",
            note: "The middle is visible from two sides and the squad arrives under watch.",
          },
          {
            id: "r8-central-rock-b",
            label: "North step",
            intel: "Step of ground north of the rock approach.",
            x: 163,
            y: 107,
            arrival: { x: 190, y: 112 },
            exposure: "high",
            note: "The rock draws both outer squads and the squad arrives between them.",
          },
        ],
      },
      {
        id: "blind-dip",
        label: "Hide in the shallow dip and wait",
        quality: "weak",
        explanation:
          "Total concealment with zero information is a gamble: without sightlines the final pull can force a blind move at the worst moment.",
        route: {
          style: "open",
          points: [
            { x: 150, y: 150 },
            { x: 225, y: 160 },
          ],
          caption: "Short move to the dip.",
        },
        crossings: [
          {
            id: "r8-blind-dip-a",
            label: "West rim",
            intel: "Rim of the dip on the near side.",
            x: 188,
            y: 155,
            arrival: { x: 232, y: 158 },
            exposure: "high",
            note: "The rim drops out of sight and the next pull is unreadable.",
          },
          {
            id: "r8-blind-dip-b",
            label: "Low fold",
            intel: "Fold in the ground short of the dip on the line.",
            x: 162,
            y: 172,
            arrival: { x: 220, y: 166 },
            exposure: "high",
            note: "The fold hides the squad early and the dip still pulls blind.",
          },
        ],
      },
    ],
    reveals: [
      {
        id: "r8-rock",
        kind: "landmark",
        targetId: "rock",
        title: "Central rock",
        intel: "Middle of NEXT with sightlines both ways. Two squads can see this rock from their sides.",
        x: 180,
        y: 120,
      },
      {
        id: "r8-tree",
        kind: "landmark",
        targetId: "tree",
        title: "Edge tree",
        intel: "Lone tree on the zone edge. The trunk breaks sightlines from one side; the view reaches the middle.",
        x: 158,
        y: 138,
      },
      {
        id: "r8-dip",
        kind: "landmark",
        targetId: "dip",
        title: "Shallow dip",
        intel: "Low ground that blocks sightlines in and out. From inside, the next pull is unreadable until it shifts.",
        x: 225,
        y: 160,
      },
      {
        id: "r8-squads",
        kind: "threat",
        targetId: "central-rock",
        title: "Other squads",
        intel: "Five players across three squads. The two outer squads face each other across the middle.",
        x: 180,
        y: 60,
      },
    ],
    principle: "In final circles, concealment often outlasts control in the middle — let others meet first.",
  },
];
