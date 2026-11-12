/**
 * IGL Decision Drill scenario bank — 6 authored synthetic practice scenarios.
 *
 * Each scenario hands the player an in-game leader's snapshot (teams left,
 * position, terrain, zone, resources, threats, timing) plus up to two
 * inspectable intel facts, then asks for one committed call from the
 * fight / avoid / hold / rotate families. Exactly one option per scenario
 * is the stronger call *in this situation* — never a universal verdict.
 *
 * Framing (do not weaken): these are illustrative tactical snapshots for
 * decision training. They do not reproduce real matches, do not predict
 * real circles or outcomes, and the principles are heuristics ("often",
 * "tends to", "in this situation"), never laws. Every weak option carries
 * a genuine upside before its `weakerBecause` explains the cost here;
 * every scenario carries an `uncertainty` note so the drill teaches
 * judgment, not certainty.
 *
 * Pure data: no React, no state, no scoring, no imports. The island
 * component renders this; `igl-decision-logic.ts` holds the testable rules.
 */

export type IglFamily = "fight" | "avoid" | "hold" | "rotate";

export type IglQuality = "strong" | "weak";

export interface IglIntel {
  /** Stable per-scenario id, e.g. "crossfire-north". Unique within its scenario. */
  readonly id: string;
  /** Short title shown on the inspect control. */
  readonly title: string;
  /** Concise fact — information only, never a verdict or a nudge toward a call. */
  readonly body: string;
}

export interface IglBrief {
  readonly remainingTeams: string;
  readonly position: string;
  readonly terrain: string;
  readonly zone: string;
  readonly resources: string;
  readonly threats: string;
  readonly timing: string;
}

export interface IglOption {
  readonly id: string;
  readonly label: string;
  /** Decision family of this call — authored explicitly, never inferred. */
  readonly family: IglFamily;
  readonly quality: IglQuality;
  /** Why this call is defensible HERE. Present on the strong option only. */
  readonly rationale?: string;
  /**
   * The genuine upside's cost: acknowledges what the call offers, then why
   * it falls short in this situation. Present on weak options only.
   */
  readonly weakerBecause?: string;
  /** Authored outcome line, revealed only after commit. */
  readonly consequence: string;
}

export interface IglScenario {
  readonly id: string;
  readonly title: string;
  /** Neutral context — enough to decide, without grading any call. */
  readonly situation: string;
  readonly brief: IglBrief;
  /** 1–2 inspectable facts per scenario. Free to read, no economy. */
  readonly intel: readonly IglIntel[];
  /** The explicit decision question. */
  readonly question: string;
  /** 2–3 calls, exactly one strong. Labels are the calls themselves. */
  readonly options: readonly IglOption[];
  /** One transferable, hedged principle. */
  readonly principle: string;
  /** Where this call could still fail — judgment, not certainty. */
  readonly uncertainty: string;
}

export const IGL_DECISION_SCENARIOS: readonly IglScenario[] = [
  {
    id: "third-party-trap",
    title: "The third-party trap",
    situation:
      "Mid-game on Erangel. Your full squad of four holds a two-storey compound on the zone edge. Two squads are trading knocks 150 meters to the north, and the next zone pulls northeast, away from you. A fueled vehicle sits beside the compound.",
    brief: {
      remainingTeams: "9 teams · 31 players alive",
      position: "Two-storey compound on the current zone edge",
      terrain: "Open wheat field north; ridge line east with scattered rocks",
      zone: "Next circle pulls northeast — the compound falls outside",
      resources: "Full squad · fueled vehicle · 6 smokes · full boosts",
      threats: "Two squads trading 150 m north; movement on the eastern ridge",
      timing: "About 40 seconds before the zone starts moving",
    },
    intel: [
      {
        id: "crossfire-north",
        title: "Northern fight",
        body: "At least four knocks traded in the last minute. Both squads are still strong enough to turn on a new arrival.",
      },
      {
        id: "crossfire-east",
        title: "Eastern ridge",
        body: "Movement on the ridge line twice in the last minute — a squad is already set where the next zone plays.",
      },
    ],
    question: "The lobby is about to shrink around a fight you are not in. What is your call?",
    options: [
      {
        id: "crossfire-crash",
        label: "Crash the northern fight and third-party both squads",
        family: "fight",
        quality: "weak",
        weakerBecause:
          "Finishes are tempting, but arriving third into a fight between two full squads spends the vehicle, the smokes, and the squad's health — and leaves whoever survives exposed to the set squad east, outside the next zone either way.",
        consequence:
          "Your squad arrives as the fight ends — damaged, smoked out, and staring at a set ridge while the zone moves.",
      },
      {
        id: "crossfire-slip",
        label: "Slip east early along the ridge before it settles",
        family: "avoid",
        quality: "strong",
        rationale:
          "Leaving while both northern squads are busy keeps all four players and every smoke for the part of the game that decides placement. The ridge is the only ground in view that plays in two consecutive zones.",
        consequence:
          "Your squad crosses to the ridge untouched while the northern fight burns both squads' utility — and arrives with a full kit for the next shift.",
      },
      {
        id: "crossfire-hold",
        label: "Hold the compound one more zone and heal through the edge",
        family: "hold",
        quality: "weak",
        weakerBecause:
          "Patience has value, but the compound falls outside the next circle — holding spends health and boosts defending ground the game has already taken away, and the late exit crosses the same open field with less cover.",
        consequence:
          "The zone bites through the hold, and the late exit crosses open ground with half the smokes gone.",
      },
    ],
    principle: "Fights you do not need are the most expensive ones — arrive at the zones that matter with a full squad.",
    uncertainty:
      "The ridge squad could still collapse onto the crossing, and the northern fight could end cleanly. Both can fail — slipping east simply fails in fewer ways here.",
  },
  {
    id: "split-pairs",
    title: "Split across the gap",
    situation:
      "Your squad is split: two players hold a ridge inside the next zone, two are at a compound 80 meters behind the current zone edge. The gap between them is low open ground. Shots are sporadic — nobody has either pair pinned yet.",
    brief: {
      remainingTeams: "11 teams · 38 players alive",
      position: "Pair on the ridge (in-zone) · pair at the compound (behind the edge)",
      terrain: "80 m of low open ground between the pairs, no cover",
      zone: "Current edge reaches the compound in about a minute",
      resources: "Full squad · 4 smokes split across the pairs · one vehicle at the compound",
      threats: "Sporadic shots only — no squad committed to either pair",
      timing: "About a minute before the edge reaches the compound",
    },
    intel: [
      {
        id: "split-gap",
        title: "Gap crossing",
        body: "Crossing now meets no prepared fire. Every minute the far side settles further and the window narrows.",
      },
      {
        id: "split-ridge",
        title: "Ridge pair",
        body: "Two players above the next zone with sightlines on both entries, holding smokes to cover a crossing.",
      },
    ],
    question: "Half your squad is safe and half is not. What is your call?",
    options: [
      {
        id: "split-hold",
        label: "Hold the split for information and late picks",
        family: "hold",
        quality: "weak",
        weakerBecause:
          "Information has value, but the compound pair cannot survive a collapse on their own — and a late rescue run across a settled gap risks the very 2v4 the split was meant to avoid.",
        consequence:
          "The compound pair gets collapsed during their rotation, and the ridge pair watches it happen from safety.",
      },
      {
        id: "split-regroup",
        label: "Regroup on the ridge now, all four together",
        family: "rotate",
        quality: "strong",
        rationale:
          "The ridge is where the next zone plays, and crossing as four while the timing is calm beats a late rescue run every time. Together the squad can hold, scout, and choose the next move.",
        consequence:
          "The compound pair crosses calmly under the ridge pair's cover, and all four arrive ready for the next shift.",
      },
      {
        id: "split-clear",
        label: "Send the compound pair to clear the nearest threat first",
        family: "fight",
        quality: "weak",
        weakerBecause:
          "Proactivity feels strong, but the nearest threat is unlocated sporadic fire — two players hunting ghosts across open ground while the zone clock runs is how pairs get picked apart.",
        consequence:
          "The compound pair chases shadows, takes a knock in the open, and the revive burns the crossing window.",
      },
    ],
    principle: "A split that cannot support itself is two weak squads, not one flexible one.",
    uncertainty:
      "Crossing together can still walk into a prepared angle. Regrouping fails less often than rescuing — but it can still fail.",
  },
  {
    id: "occupied-compound",
    title: "The occupied compound",
    situation:
      "The next circle centers on a walled compound held by two squads, while a rocky southern edge sits empty with scattered cover. Your full squad approaches from the south with smokes to spare.",
    brief: {
      remainingTeams: "7 teams · 24 players alive",
      position: "Approaching from the south at full strength",
      terrain: "Walled compound north (occupied) · rocky southern edge (empty)",
      zone: "Next circle centers on the compound",
      resources: "Full squad · smokes to spare · full boosts",
      threats: "Two squads inside the compound walls",
      timing: "Zone closes in under a minute",
    },
    intel: [
      {
        id: "compound-walls",
        title: "Compound walls",
        body: "Two squads inside with sightlines on the only gate. The last squad to enter took the fight and lost two players at the wall.",
      },
      {
        id: "compound-edge",
        title: "Southern edge",
        body: "Rocks break sightlines every 15 meters up to the zone. Smokes stretch across the whole entry from the west.",
      },
    ],
    question: "The center is taken and the edge is free. What is your call?",
    options: [
      {
        id: "compound-edge",
        label: "Take the southern edge behind smokes",
        family: "rotate",
        quality: "strong",
        rationale:
          "The edge needs no one's permission: rocks plus smokes carry all four players into the zone while the compound squads spend their utility on each other. Position first, then decide from safety.",
        consequence:
          "Your squad settles behind the edge rocks untouched while the compound burns both squads' smokes on each other.",
      },
      {
        id: "compound-contest",
        label: "Contest the compound head-on through the gate",
        family: "fight",
        quality: "weak",
        weakerBecause:
          "Directness has an appeal, but the gate faces two set squads and the last team through it lost half their squad — trading lives for a position you may still have to abandon burns the run before the zone even closes.",
        consequence:
          "The gate meets prepared fire, two players drop at the wall, and the survivors back out with nothing to show.",
      },
      {
        id: "compound-wrap",
        label: "Circle wide around both and play the far rocks",
        family: "avoid",
        quality: "weak",
        weakerBecause:
          "Avoiding the fight sounds safe, but the long wrap crosses the most open ground on the map and arrives after the edge is taken — conceding both the compound and the good edge for rocks nobody contests because they do not matter yet.",
        consequence:
          "The wrap eats every smoke and arrives late to rocks outside the next shift, with the edge already taken.",
      },
    ],
    principle: "Contested cover costs more than it shelters — take the ground nobody is watching.",
    uncertainty:
      "The edge can still be pinched from two sides late. It fails less often than a gate crash in this spot — not never.",
  },
  {
    id: "road-timing",
    title: "When to drive",
    situation:
      "Your squad must cross a long road stretch to reach the next zone. A sturdy vehicle sits fueled beside you. Two squads are posted on the far side, still shifting between buildings, and the zone edge is still distant.",
    brief: {
      remainingTeams: "8 teams · 29 players alive",
      position: "Near side of a long road crossing",
      terrain: "100 m of road with ditches on both sides",
      zone: "Next zone across the road; the edge is still distant",
      resources: "Full squad · fueled vehicle · full boosts",
      threats: "Two squads on the far side, still moving between buildings",
      timing: "Far side settles more with every passing minute",
    },
    intel: [
      {
        id: "road-farside",
        title: "Far-side movement",
        body: "Both squads are still rotating between buildings — their view of the road sharpens once they stop moving.",
      },
      {
        id: "road-ditch",
        title: "Ditch cover",
        body: "Ditches on both sides hide a dismount but not a crossing. A vehicle clears the road in seconds; on foot the same stretch takes far longer.",
      },
    ],
    question: "The crossing is open now and watched later. What is your call?",
    options: [
      {
        id: "road-late",
        label: "Wait in the ditch, then drive at the last moment",
        family: "hold",
        quality: "weak",
        weakerBecause:
          "Patience usually helps, but waiting gives both far-side squads time to set crossfire on the only crossing — the late drive then arrives damaged, loud, and exactly where two squads are aiming.",
        consequence:
          "The late drive meets prepared fire from both buildings and arrives with a smoking vehicle and two players needing meds.",
      },
      {
        id: "road-foot",
        label: "Abandon the vehicle and cross on foot through the ditches",
        family: "avoid",
        quality: "weak",
        weakerBecause:
          "Quiet has an appeal, but 100 meters on foot keeps four slow targets in the open for far longer than a vehicle would — and ditches hide the crossing from no one once the far side stops moving.",
        consequence:
          "The foot crossing gets spotted halfway, and the squad arrives split, late, and without the vehicle for the next shift.",
      },
      {
        id: "road-now",
        label: "Drive now while the far side is still settling",
        family: "rotate",
        quality: "strong",
        rationale:
          "Crossing before the far side stops moving trades a loud entry for an unpunished one. Speed here buys what matters — arriving before crossfire exists, not outrunning it.",
        consequence:
          "The vehicle crosses before either far-side squad is set, and the squad dismounts into cover with the crossing behind them.",
      },
    ],
    principle: "Vehicle timing beats vehicle speed — cross before the far side stops moving.",
    uncertainty:
      "An early drive can still meet an unlucky spray. Waiting simply lets the far side aim it — the risk moves, it never vanishes.",
  },
  {
    id: "knocked-triage",
    title: "The knocked teammate",
    situation:
      "Mid-rotation across open ground, one teammate is knocked 20 meters behind the only nearby cover. The zone is already moving, smokes are in hand, and one squad holds the ridge your squad needs to reach.",
    brief: {
      remainingTeams: "6 teams · 19 players alive",
      position: "Mid-rotation, 20 m short of the only rock cover",
      terrain: "Open ground behind · rock cluster ahead under a held ridge",
      zone: "Zone is moving now — every second costs health",
      resources: "Three up, one knocked · 3 smokes · meds to spare",
      threats: "One squad holding the ridge ahead",
      timing: "Zone damage is ticking; the revive takes seconds",
    },
    intel: [
      {
        id: "triage-ridge",
        title: "Ridge holders",
        body: "One squad on the ridge, mostly watching the rocks ahead — but their angle drifts across the open ground between shifts.",
      },
      {
        id: "triage-smoke",
        title: "Smoke window",
        body: "Three smokes cover the 20 meters to the rocks if thrown now. The window holds for this rotation, not the next one.",
      },
    ],
    question: "A teammate is down in the open and the zone is moving. What is your call?",
    options: [
      {
        id: "triage-abandon",
        label: "Leave the knocked player and take the ridge fight as three",
        family: "fight",
        quality: "weak",
        weakerBecause:
          "Decisiveness feels strong, but trading a certain fourth player for a 3v4 into a set ridge spends the revive, the smokes, and likely two more players — for ground the full squad could have taken together.",
        consequence:
          "Three players reach the rocks loud and split, and the ridge squad meets them before anyone heals.",
      },
      {
        id: "triage-stick",
        label: "Pop smokes, finish the revive, then move as four",
        family: "hold",
        quality: "strong",
        rationale:
          "Four players with cover beat three without smokes. The ridge watches the rocks, not the fall site — the revive happens where nobody is aiming, and the squad arrives whole.",
        consequence:
          "Smokes bloom over the fall site, the revive completes unseen, and four players reach the rocks with meds to spare.",
      },
      {
        id: "triage-drag",
        label: "Drag the knocked player and crawl the full distance",
        family: "rotate",
        quality: "weak",
        weakerBecause:
          "Keeping everyone together sounds right, but dragging 20 meters moves at crawl pace under zone damage — the revive finishes after the zone has already decided the fight.",
        consequence:
          "The drag eats the smoke window, and the zone closes over the squad glide path before the revive lands.",
      },
    ],
    principle: "Count what a call costs in players first — four players arriving together beat three arriving fast.",
    uncertainty:
      "The ridge could shift fire mid-revive and punish the stick. Sticking still risks less than arriving short-handed — but the risk is real.",
  },
  {
    id: "final-seconds",
    title: "The last sixty seconds",
    situation:
      "Final circle: five players left across three squads. A central rock offers sightlines both ways, a lone tree stands on the edge, and a shallow dip nearby blocks sightlines in and out.",
    brief: {
      remainingTeams: "3 squads · 5 players",
      position: "Between rock, tree, and dip at the zone edge",
      terrain: "Central rock (exposed both ways) · lone edge tree · shallow blind dip",
      zone: "Final circle — no more rotations after this",
      resources: "Full health · one smoke · full boosts",
      threats: "Two outer squads facing each other across the middle",
      timing: "Seconds before the final shift",
    },
    intel: [
      {
        id: "final-others",
        title: "Other squads",
        body: "Five players across three squads, and the two outer squads face each other across the middle.",
      },
      {
        id: "final-tree",
        title: "Edge tree",
        body: "A lone trunk on the zone edge — breaks sightlines from one side and keeps a view of the middle.",
      },
    ],
    question: "Three squads, one circle, seconds left. Where do you play?",
    options: [
      {
        id: "final-rock",
        label: "Take the central rock",
        family: "fight",
        quality: "weak",
        weakerBecause:
          "The middle looks commanding, but it is visible from two sides — holding it means fighting both remaining squads instead of letting them meet, and spending the meds needed for the final shift.",
        consequence:
          "The rock draws fire from both sides, and the hold burns through meds before the final shift lands.",
      },
      {
        id: "final-tree",
        label: "Play the edge tree and wait",
        family: "avoid",
        quality: "strong",
        rationale:
          "Concealment outlasts control in the final seconds: the middle draws both outer squads toward each other while the edge tree keeps one player unseen until the final shift decides it.",
        consequence:
          "Both outer squads meet in the middle while the edge tree keeps its player unseen into the final shift.",
      },
      {
        id: "final-dip",
        label: "Hide in the shallow dip and wait",
        family: "hold",
        quality: "weak",
        weakerBecause:
          "Total concealment feels safe, but with zero sightlines the final pull can force a blind move at the worst moment — hiding from information is not the same as hiding from damage.",
        consequence:
          "The dip hides everything, including the information needed — the final shift forces a blind climb into waiting guns.",
      },
    ],
    principle: "In final circles, let the lobby come to you — concealment outlasts control.",
    uncertainty:
      "The tree can still be checked by a disciplined sweep. Waiting unseen fails less often than holding the middle — not never.",
  },
];

export const IGL_DECISION_TOTAL = IGL_DECISION_SCENARIOS.length;

export function getIglDecisionScenario(id: string): IglScenario | null {
  return IGL_DECISION_SCENARIOS.find((s) => s.id === id) ?? null;
}
