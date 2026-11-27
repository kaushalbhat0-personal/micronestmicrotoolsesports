import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHELL = readFileSync(join(process.cwd(), "src/components/marketing/bgmi-lab/game-page-shell.tsx"), "utf8");
const AD_SAFE = readFileSync(join(process.cwd(), "src/components/marketing/bgmi-lab/ad-safe-game-layout.tsx"), "utf8");
const ROUTE = readFileSync(join(process.cwd(), "src/app/bgmi-lab/[slug]/page.tsx"), "utf8");

/** Strip block + line comments: the boundary is documented in prose, but no code binding may reference it. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

describe("bgmi-lab shell — reusable server structure + ad-safe boundary", () => {
  it("shell carries no game state, data client, or billing", () => {
    for (const source of [codeOnly(SHELL), codeOnly(AD_SAFE)]) {
      expect(source).not.toMatch(/useState|useEffect|useReducer/);
      expect(source).not.toContain("createAdminClient");
      expect(source).not.toContain("service_role");
      expect(source).not.toContain("entitlement");
      expect(source).not.toContain("billing");
      expect(source).not.toContain("supabase");
    }
  });

  it("shell owns the canonical section order incl. explanation before related content", () => {
    const order = ["<AnswerBlock", "<AdSafeGameLayout", "How it works", "How to practice", "<GameFaq", "<RelatedLabGames"];
    let lastIndex = -1;
    for (const marker of order) {
      const index = SHELL.indexOf(marker);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("ad-safe boundary renders no ads, placeholders, or SDK hooks", () => {
    const code = codeOnly(AD_SAFE);
    for (const banned of ["adsbygoogle", "adsense", "<Ad", "ca-pub", "Advertisement", "ins className=\"adsbygoogle"]) {
      expect(code.toLowerCase()).not.toContain(banned.toLowerCase());
    }
    expect(code).toContain("data-ad-safe");
  });

  it("route resolves islands only through the loader map (no hardcoded game import)", () => {
    expect(ROUTE).toContain("resolveLabGame");
    expect(ROUTE).not.toContain("circle-iq-shell");
    expect(ROUTE).not.toContain("CircleIqShell");
  });
});
