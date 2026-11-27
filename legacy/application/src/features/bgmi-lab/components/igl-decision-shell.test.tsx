import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";
import { hasLabGame, resolveLabGame } from "../games";
import { IglDecisionShell } from "./igl-decision-shell";
import { ShareRow } from "./share-row";
import { IGL_DECISION_TOTAL } from "../data/igl-decision-logic";

const PROD_URL = "https://micronestmicrotoolsesports.vercel.app/bgmi-lab/igl-decision-drill";

describe("igl-decision shell — first paint", () => {
  // renderToString emits <!-- --> between JSX text nodes — normalize once.
  const html = renderToString(<IglDecisionShell />).replace(/<!--.*?-->/g, "");

  it("opens on the first tactical brief with a semantic definition list", () => {
    expect(html).toContain("CALL 01 / 06");
    expect(html).toContain("IGL drill");
    expect(html).toContain("The third-party trap");
    expect(html).toContain("<dl");
    expect(html).toContain("Remaining");
    expect(html).toContain("Timing");
  });

  it("asks the question with native choices and no reveal yet", () => {
    expect(html).toContain("Your call");
    expect(html).toContain("is your call?");
    expect(html.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Commit to this call");
    expect(html).not.toContain("What followed");
    expect(html).not.toContain("Stronger call");
  });

  it("labels intel as free reads with no locked economy", () => {
    expect(html).toContain("INSPECT");
    expect(html).toContain("Northern fight");
    expect(html).not.toMatch(/scout/i);
  });

  it("meets touch-target and live-region contracts", () => {
    expect(html).toMatch(/min-h-\[44px\]/);
    expect(html).toContain("aria-live");
    expect(html).toContain('role="group"');
    expect(html).toContain("aria-label");
  });
});

describe("igl-decision share — canonical result", () => {
  const tool = getBgmiLabTool("igl-decision-drill")!;
  const html = renderToString(
    <ShareRow
      gameName="IGL Decision Drill"
      score={5}
      total={6}
      resultNoun="stronger calls"
      shareText={tool.shareText ?? ""}
      canonicalUrl={PROD_URL}
    />
  ).replace(/<!--.*?-->/g, "");

  it("shares the result-aware URL with no tracking or localhost", () => {
    expect(html).toContain(encodeURIComponent(`${PROD_URL}?result=5-6`));
    expect(html).toContain("https://wa.me/?text=");
    expect(html).not.toContain("localhost");
    expect(html).not.toMatch(/utm_|referral=|tracking=/);
    expect(html).toContain("Your score stays on this device");
  });

  it("builds the canonical URL from the registry path", () => {
    expect(labAbsoluteUrl("/bgmi-lab/igl-decision-drill")).toContain("/bgmi-lab/igl-decision-drill");
    expect(labAbsoluteUrl("/bgmi-lab/igl-decision-drill")).not.toMatch(/\?/);
  });
});

describe("igl-decision registry + loader", () => {
  it("is available, practice, and synthetic with full content", () => {
    const tool = getBgmiLabTool("igl-decision-drill")!;
    expect(tool.status).toBe("available");
    expect(tool.category).toBe("practice");
    expect(tool.scenarioKind).toBe("synthetic");
    expect(tool.shareText?.length ?? 0).toBeGreaterThan(0);
    expect(tool.ogMotif?.length ?? 0).toBeGreaterThan(0);
    expect(tool.answer?.length ?? 0).toBeGreaterThan(40);
    expect(tool.faqs.length).toBeGreaterThanOrEqual(5);
  });

  it("is routable with a loader island", () => {
    expect(hasLabGame("igl-decision-drill")).toBe(true);
    expect(resolveLabGame("igl-decision-drill")).not.toBeNull();
  });

  it("answers the SEO questions without prediction claims", () => {
    const tool = getBgmiLabTool("igl-decision-drill")!;
    expect(tool.answer).toContain("6 synthetic");
    const copy = [tool.name, tool.tagline, tool.description, tool.answer ?? "", tool.methodology].join(" ");
    expect(copy).not.toMatch(/will predict|predicts|guarantee|best possible/i);
    const denial = tool.faqs.some((f) => /predict/i.test(f.question) && /No\.|not a prediction/i.test(f.answer));
    expect(denial).toBe(true);
  });
});

describe("igl-decision shell — safety boundaries", () => {
  it("reads the recipient payload against its own total", () => {
    const shell = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/igl-decision-shell.tsx"), "utf8");
    expect(shell).toContain("useSharedLabResult(IGL_DECISION_TOTAL)");
    expect(shell).toContain('resultNoun="stronger calls"');
    expect(shell).toContain('gameName="IGL Decision Drill"');
    expect(shell).not.toContain("buildLabShareMessage");
  });

  it("stays client-side with no data, ad, or monetization surface", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const shell = strip(
      readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/igl-decision-shell.tsx"), "utf8")
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
    const html = renderToString(<IglDecisionShell />);
    expect(html).not.toMatch(/was the correct|should have|optimal|prediction|skill rating|guarantee|best play|leaderboard|percentile/i);
  });

  it("pins the expected share total to the scenario bank", () => {
    expect(IGL_DECISION_TOTAL).toBe(6);
  });
});

describe("igl-decision responsive hardening — layout contract", () => {
  const shellSrc = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/igl-decision-shell.tsx"), "utf8");

  it("keeps the brief stacked on mobile with sm: enhancements and no fixed widths", () => {
    expect(shellSrc).toContain("flex flex-col");
    expect(shellSrc).toContain("sm:flex-row");
    expect(shellSrc).toContain("sm:grid-cols-2");
    expect(shellSrc).toContain("sm:w-auto");
    // No fixed-width, min-width, nowrap, or scrolling gameplay elements.
    for (const banned of ["w-[", "min-w-", "max-w-[", "whitespace-nowrap", "overflow-x-", "overflow:scroll"]) {
      expect(shellSrc, `gameplay must not contain ${banned}`).not.toContain(banned);
    }
  });

  it("keeps the base/sm breakpoint model with no md/lg gameplay branches", () => {
    for (const bp of ["md:", "lg:", "xl:", "2xl:"]) {
      expect(shellSrc, `gameplay must not branch on ${bp}`).not.toContain(bp);
    }
  });

  it("keeps primary actions full-width on mobile", () => {
    expect(shellSrc).toContain("w-full");
    expect(shellSrc).toContain("sm:w-auto");
    expect(shellSrc).toContain("justify-center");
  });
});
