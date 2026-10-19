/**
 * BGMI Lab registry — public free practice/learning tools.
 *
 * Structural separation (architectural boundary):
 * - No internalSlug, no TOOL_PLAN_PREFIX, no plan IDs, no prices.
 * - No entitlement, billing, auth, organization, or Supabase imports.
 * - `status: "available" | "planned"` is a public-discovery flag only —
 *   never the workspace `comingSoon` semantics.
 *
 * Only "available" tools get routes/sitemap/indexing. "planned" entries
 * are catalog data for the Lab index (coming-soon cards, no pages).
 */

export type BgmiLabStatus = "available" | "planned";

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
  readonly methodology: string;
  readonly instructions: readonly string[];
  readonly faqs: readonly BgmiLabFaq[];
  readonly examples?: readonly string[];
  readonly tournamentContext?: string;
  readonly disclaimer?: string;
  readonly relatedHubHref?: string;
  readonly relatedSimulatorHref?: string;
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
    description: "Free BGMI IGL drill: short scenarios with trade-offs. Planned entry — not yet playable.",
    icon: "Crosshair",
    status: "planned",
    methodology: "Planned drill presenting fight, split, or reset decisions with explained outcomes.",
    instructions: ["Planned: decision scenarios are being designed."],
    faqs: [{ question: "When will this drill be available?", answer: "It is planned. Circle IQ is the available drill today." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "final-circle",
    name: "Final Circle Drill",
    tagline: "Win the last 60 seconds.",
    description: "Free BGMI endgame drill: positioning and utility use in final circles. Planned entry — not yet playable.",
    icon: "Trophy",
    status: "planned",
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
    tagline: "Learn how zones actually behave.",
    description: "Free BGMI learning page: common zone behaviours explained simply. Planned entry — not yet playable.",
    icon: "Newspaper",
    status: "planned",
    methodology: "Planned visual explainer of pull direction, edge play, and gatekeeping risk.",
    instructions: ["Planned: pattern content is being written."],
    faqs: [{ question: "When will this be available?", answer: "It is planned. Circle IQ is the available drill today." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "rotation-replay",
    name: "Rotation Replay",
    tagline: "Replay a rotation, call by call.",
    description: "Free BGMI replay study: step through a sample rotation with commentary. Planned entry — not yet playable.",
    icon: "ArrowRight",
    status: "planned",
    methodology: "Planned step-through replays with IGL commentary at each decision point.",
    instructions: ["Planned: replay scripts are being written."],
    faqs: [{ question: "When will this be available?", answer: "It is planned. Circle IQ is the available drill today." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "tournament-scenarios",
    name: "Tournament Scenarios",
    tagline: "Practice the points race.",
    description:
      "Free BGMI scenario practice linked to tournament standings. Planned entry — the Qualification Simulator covers points planning today.",
    icon: "ClipboardList",
    status: "planned",
    methodology: "Planned scenario packs derived from public tournament formats; points planning stays in the Qualification Simulator.",
    instructions: ["Planned: scenario packs are being designed."],
    faqs: [{ question: "Where can I practice points scenarios today?", answer: "Use the BGMI Qualification Simulator — it is free with no signup." }],
    disclaimer: DISCLAIMER,
    relatedHubHref: "/bgmi-tournaments",
    relatedSimulatorHref: "/bgmi-qualification",
  },
  {
    slug: "lift-the-trophy",
    name: "Lift the Trophy",
    tagline: "A light-hearted BGMI celebration.",
    description: "Free playful BGMI moment: lift the trophy after practice. Planned entry — not yet playable.",
    icon: "Trophy",
    status: "planned",
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
