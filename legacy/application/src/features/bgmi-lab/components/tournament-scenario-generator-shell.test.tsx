import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";
import { hasLabGame, resolveLabGame } from "../games";
import { TournamentScenarioGeneratorShell } from "./tournament-scenario-generator-shell";
import { ShareRow } from "./share-row";

const PROD_URL = "https://micronestmicrotoolsesports.vercel.app/bgmi-lab/tournament-scenario-generator";

describe("scenario-generator shell — first paint", () => {
  // renderToString emits <!-- --> between JSX text nodes — normalize once.
  const html = renderToString(<TournamentScenarioGeneratorShell />).replace(/<!--.*?-->/g, "");

  it("opens on the first tournament context with visible attribution", () => {
    expect(html).toContain("SCENARIO 01 / 06");
    expect(html).toContain("Tournament scenario");
    expect(html).toContain("BMSD 2026");
    expect(html).toContain("Match 2 of 18");
    expect(html).toContain("Erangel");
    expect(html).toContain("Day 1");
  });

  it("frames the content as recorded context plus authored scenario", () => {
    expect(html).toContain("Built from recorded tournament context");
    expect(html).toContain("Make the call");
    // Spotlight team's recorded result is visible pre-reveal; the winner
    // stays hidden until the player commits to a call.
    expect(html).toContain("Nebula Esports");
    expect(html).not.toContain("Rntx");
  });

  it("asks the question with three native choices and no reveal yet", () => {
    expect(html).toContain("Make the call");
    expect(html.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("What actually happened");
  });

  it("labels the diagram as an abstract Lab frame, never a map", () => {
    expect(html).toContain("PRACTICE SCENARIO");
    expect(html).toContain("not a map");
  });

  it("meets touch-target and live-region contracts", () => {
    expect(html).toMatch(/min-h-\[44px\]/);
    expect(html).toContain("aria-live");
    expect(html).toContain('role="group"');
    expect(html).toContain("aria-label");
  });
});

describe("scenario-generator share — canonical result", () => {
  const tool = getBgmiLabTool("tournament-scenario-generator")!;
  const html = renderToString(
    <ShareRow
      gameName="Tournament Scenario Generator"
      score={4}
      total={6}
      resultNoun="stronger practice reads"
      shareText={tool.shareText ?? ""}
      canonicalUrl={PROD_URL}
    />
  );

  it("shares the canonical path with no tracking or localhost", () => {
    expect(html).toContain(encodeURIComponent(PROD_URL));
    expect(html).toContain("https://wa.me/?text=");
    expect(html).not.toContain("localhost");
    expect(html).not.toMatch(/utm_|referral=|tracking=/);
    expect(html).toContain("Your score stays on this device");
  });

  it("builds the canonical URL from the registry path", () => {
    expect(labAbsoluteUrl("/bgmi-lab/tournament-scenario-generator")).toContain("/bgmi-lab/tournament-scenario-generator");
    expect(labAbsoluteUrl("/bgmi-lab/tournament-scenario-generator")).not.toMatch(/\?/);
  });
});

describe("scenario-generator registry + loader", () => {
  it("is available, practice, and tournament-derived with a pinned source ref", () => {
    const tool = getBgmiLabTool("tournament-scenario-generator")!;
    expect(tool.status).toBe("available");
    expect(tool.category).toBe("practice");
    expect(tool.scenarioKind).toBe("tournament-derived");
    expect(tool.scenarioRef).toMatchObject({ tournamentSlug: "bmsd-2026", stageSlug: "grand-finals" });
    expect(tool.shareText?.length ?? 0).toBeGreaterThan(0);
    expect(tool.ogMotif?.length ?? 0).toBeGreaterThan(0);
    expect(tool.relatedHubHref).toBe("/bgmi-tournaments/bmsd-2026/grand-finals");
  });

  it("is routable with a loader island", () => {
    expect(hasLabGame("tournament-scenario-generator")).toBe(true);
    expect(resolveLabGame("tournament-scenario-generator")).not.toBeNull();
  });

  it("answers the SEO questions without prediction claims", () => {
    const tool = getBgmiLabTool("tournament-scenario-generator")!;
    expect(tool.answer).toContain("does not predict future matches");
    const copy = [tool.name, tool.tagline, tool.description, tool.answer ?? "", tool.methodology].join(" ");
    expect(copy).not.toMatch(/will predict|predicts|guarantee|best possible/i);
    const denial = tool.faqs.some((f) => /predict/i.test(f.question) && /No\.|not a prediction/i.test(f.answer));
    expect(denial).toBe(true);
    expect(tool.faqs.length).toBeGreaterThanOrEqual(5);
  });
});

describe("scenario-generator shell — safety boundaries", () => {
  it("stays client-side with no data, ad, or monetization surface", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const shell = strip(
      readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/tournament-scenario-generator-shell.tsx"), "utf8")
    );
    for (const banned of [
      "supabase",
      "createClient",
      "service_role",
      "fetch(",
      "/api/",
      "adsbygoogle",
      "ca-pub",
      "advertisement",
      "billing",
      "entitlement",
      "localStorage",
      "sessionStorage",
      "analytics",
    ]) {
      expect(shell).not.toContain(banned);
    }
  });

  it("never renders certainty language in the island copy", () => {
    const html = renderToString(<TournamentScenarioGeneratorShell />);
    expect(html).not.toMatch(/was the correct|should have|optimal|prediction|skill rating|guarantee/i);
  });
});
