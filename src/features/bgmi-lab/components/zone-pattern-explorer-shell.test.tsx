import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { hasLabGame, resolveLabGame } from "../games";
import { ZonePatternExplorerShell } from "./zone-pattern-explorer-shell";

describe("zone-pattern-explorer shell — first paint", () => {
  const html = renderToString(<ZonePatternExplorerShell />).replace(/<!--.*?-->/g, "");

  it("opens on the default dataset with sample size and honesty framing", () => {
    expect(html).toContain("Explore the record");
    expect(html).toContain("BGMI Masters Series Season 5");
    expect(html).toContain("18 COMPLETED MATCHES");
    expect(html).toContain("REV 720523");
    expect(html).toContain("never a prediction");
    expect(html).toContain("Published results only");
  });

  it("offers labelled native filters with usable targets", () => {
    for (const id of ["zpe-dataset", "zpe-map", "zpe-day", "zpe-team"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("All maps");
    expect(html).toContain("All days");
    expect(html).toContain("All teams");
    expect(html).toMatch(/min-h-\[44px\]/);
  });

  it("renders pattern sections with real recorded content", () => {
    expect(html).toContain("Match winners");
    expect(html).toContain("Placement distribution");
    expect(html).toContain("Finishes &amp; points");
    expect(html).toContain("Team consistency");
    expect(html).toContain("Day progression");
    expect(html).toContain("Nebula Esports");
    expect(html).toContain("Top 4");
    expect(html).toContain("View the published stage");
  });

  it("keeps tables and charts accessible without color-only meaning", () => {
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    expect(html).toContain('role="img"');
    expect(html).toContain("aria-label");
    expect(html).toContain("aria-live");
  });

  it("never renders prediction, causal, or guarantee language", () => {
    expect(html).not.toMatch(/will predict|predicts the zone|predicts your zone/i);
    expect(html).not.toMatch(/guarantee|best possible|optimal rotation|correct rotation/i);
    expect(html).not.toMatch(/because they|causes|win probability/i);
  });
});

describe("zone-patterns registry + loader", () => {
  it("is available, learn, and tournament-derived with content contract", () => {
    const tool = getBgmiLabTool("zone-patterns")!;
    expect(tool.status).toBe("available");
    expect(tool.category).toBe("learn");
    expect(tool.scenarioKind).toBe("tournament-derived");
    expect(tool.answer?.length ?? 0).toBeGreaterThan(40);
    expect(tool.methodology.length).toBeGreaterThan(40);
    expect(tool.instructions.length).toBeGreaterThanOrEqual(3);
    expect(tool.faqs.length).toBeGreaterThanOrEqual(3);
    expect(tool.disclaimer?.length ?? 0).toBeGreaterThan(0);
    expect(tool.relatedHubHref).toBe("/bgmi-tournaments");
  });

  it("answers the SEO questions with a prediction denial", () => {
    const tool = getBgmiLabTool("zone-patterns")!;
    expect(tool.answer).toContain("does not predict future zones");
    const denial = tool.faqs.some((f) => /predict/i.test(f.question) && /No\./i.test(f.answer));
    expect(denial).toBe(true);
  });

  it("is routable with a loader island", () => {
    expect(hasLabGame("zone-patterns")).toBe(true);
    expect(resolveLabGame("zone-patterns")).not.toBeNull();
  });
});

describe("zone-pattern-explorer shell — safety boundaries", () => {
  it("stays client-side with no data, ad, or monetization surface", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const shell = strip(
      readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/zone-pattern-explorer-shell.tsx"), "utf8")
    );
    const lib = strip(
      readFileSync(join(process.cwd(), "src/features/bgmi-lab/data/zone-patterns.ts"), "utf8")
    );
    for (const src of [shell, lib]) {
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
        ".insert(",
        ".update(",
        ".upsert(",
        "liquipedia",
      ]) {
        expect(src).not.toContain(banned);
      }
    }
  });
});
