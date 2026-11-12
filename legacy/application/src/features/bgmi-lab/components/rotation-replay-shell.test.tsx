import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";
import { hasLabGame, resolveLabGame } from "../games";
import { RotationReplayShell } from "./rotation-replay-shell";
import { ShareRow } from "./share-row";

const PROD_URL = "https://micronestmicrotoolsesports.vercel.app/bgmi-lab/rotation-replay";

describe("rotation-replay shell — first paint", () => {
  // renderToString emits <!-- --> between JSX text nodes — normalize once.
  const html = renderToString(<RotationReplayShell />).replace(/<!--.*?-->/g, "");

  it("opens on the first tournament context with visible attribution", () => {
    expect(html).toContain("REPLAY 01 / 05");
    expect(html).toContain("Tournament replay");
    expect(html).toContain("BMSD 2026");
    expect(html).toContain("Match 1 of 18");
    expect(html).toContain("Rondo");
    expect(html).toContain("Day 1");
  });

  it("asks the question with three native choices and no reveal yet", () => {
    expect(html).toContain("Your call");
    expect(html.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain("What actually happened");
  });

  it("labels the diagram as abstract Lab analysis, never a map", () => {
    expect(html).toContain("LAB SCENARIO");
    expect(html).toContain("not a map");
    expect(html).toContain("Nebula Esports");
  });

  it("meets touch-target and live-region contracts", () => {
    expect(html).toMatch(/min-h-\[44px\]/);
    expect(html).toContain("aria-live");
    expect(html).toContain('role="group"');
    expect(html).toContain("aria-label");
  });
});

describe("rotation-replay share — canonical result", () => {
  const tool = getBgmiLabTool("rotation-replay")!;
  const html = renderToString(
    <ShareRow
      gameName="Rotation Replay"
      score={4}
      total={5}
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
    expect(labAbsoluteUrl("/bgmi-lab/rotation-replay")).toContain("/bgmi-lab/rotation-replay");
    expect(labAbsoluteUrl("/bgmi-lab/rotation-replay")).not.toMatch(/\?/);
  });
});

describe("rotation-replay registry + loader", () => {
  it("is available, learn, and tournament-derived with a pinned source ref", () => {
    const tool = getBgmiLabTool("rotation-replay")!;
    expect(tool.status).toBe("available");
    expect(tool.category).toBe("learn");
    expect(tool.scenarioKind).toBe("tournament-derived");
    expect(tool.scenarioRef).toMatchObject({ tournamentSlug: "bmsd-2026", stageSlug: "grand-finals" });
    expect(tool.shareText?.length ?? 0).toBeGreaterThan(0);
    expect(tool.ogMotif?.length ?? 0).toBeGreaterThan(0);
    expect(tool.relatedHubHref).toBe("/bgmi-tournaments/bmsd-2026/grand-finals");
  });

  it("is routable with a loader island", () => {
    expect(hasLabGame("rotation-replay")).toBe(true);
    expect(resolveLabGame("rotation-replay")).not.toBeNull();
  });

  it("answers the SEO questions without prediction claims", () => {
    const tool = getBgmiLabTool("rotation-replay")!;
    expect(tool.answer).toContain("compare your decision with what actually happened");
    const copy = [tool.name, tool.tagline, tool.description, tool.answer ?? "", tool.methodology].join(" ");
    expect(copy).not.toMatch(/will predict|predicts|guarantee|best possible/i);
    const denial = tool.faqs.some((f) => /predict/i.test(f.question) && /No\.|not a prediction/i.test(f.answer));
    expect(denial).toBe(true);
  });
});

describe("rotation-replay shell — safety boundaries", () => {
  it("stays client-side with no data, ad, or monetization surface", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const shell = strip(
      readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/rotation-replay-shell.tsx"), "utf8")
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

  it("wires the lined-up reads noun through ShareRow without duplicating share copy", () => {
    const shell = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/rotation-replay-shell.tsx"), "utf8");
    expect(shell).toContain('resultNoun="lined-up reads"');
    expect(shell).not.toContain("buildLabShareMessage");
  });

  it("never renders certainty language in the island copy", () => {
    const html = renderToString(<RotationReplayShell />);
    expect(html).not.toMatch(/was the correct|should have|optimal|prediction|skill rating/i);
  });
});
