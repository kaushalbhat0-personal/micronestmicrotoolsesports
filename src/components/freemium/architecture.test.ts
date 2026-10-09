import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Freemium primitive architecture guard (static).
 *
 * Proves the shared UI primitives are genuinely presentational: their
 * sources must not reach data, entitlement, policy, quota, or payment
 * layers, hardcode tool identities, or carry per-tool quota constants.
 * Follows the static migration-test precedent (read + assert, no mocks).
 */

const SOURCES = [
  "src/components/freemium/free-plan-badge.tsx",
  "src/components/freemium/free-usage-line.tsx",
  "src/components/freemium/upgrade-cta.tsx",
  "src/components/freemium/claim-card.tsx",
];

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

// Tokens that would indicate a layering violation if imported or referenced.
const FORBIDDEN_TOKENS = [
  "supabase", // 19. no Supabase (client, helper, or type import)
  "billing-service", // 20. no billing-service
  "entitlement-service", // 21. no entitlement-service
  "getToolFreePolicy", // 22. no policy-registry lookup
  "TOOL_FREE_POLICIES",
  "sponsor-sentinel", // 23. no tool-specific quota constants or identities
  "tie-breaker",
  "draft-ban",
  "prize-splitter",
  "FREE_",
  "userId", // no identity plumbing of any kind
  "organizationId",
  "useState", // fully controlled components only
  "useEffect",
  "fetch(", // no direct network calls
];

describe("freemium primitives are presentational-only", () => {
  for (const file of SOURCES) {
    it(`${file} imports no forbidden layer`, () => {
      const code = sourceOf(file);
      for (const token of FORBIDDEN_TOKENS) {
        expect(code, `${file} must not contain ${JSON.stringify(token)}`).not.toContain(token);
      }
    });
  }

  it("primitives import only UI, framework, and formatting layers", () => {
    for (const file of SOURCES) {
      const code = sourceOf(file);
      const imports = [...code.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] as string);
      for (const spec of imports) {
        const allowed =
          spec === "react" ||
          spec === "next/link" ||
          spec === "next" ||
          spec.startsWith("@/components/ui/") ||
          spec.startsWith("@/lib/utils/");
        expect(allowed, `${file} imports unexpected layer ${JSON.stringify(spec)}`).toBe(true);
      }
    }
  });
});
