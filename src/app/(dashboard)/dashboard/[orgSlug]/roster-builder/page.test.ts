import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROUTE = "src/app/(dashboard)/dashboard/[orgSlug]/roster-builder/page.tsx";

function source(): string {
  return readFileSync(join(process.cwd(), ROUTE), "utf8");
}

/**
 * Route contract — server-side access stays authoritative.
 * The async Server Component itself is not unit-rendered (it needs a
 * session); these assertions pin the canonical tenant flow in source.
 */
describe("roster-builder route — access and conventions", () => {
  it("establishes organization context from the URL slug", () => {
    expect(source()).toContain("requireOrganizationContext(orgSlug)");
  });

  it("gates on the roster-builder entitlement and fails closed", () => {
    const code = source();
    expect(code).toContain('requireEntitlement(ctx.organization.id, "roster-builder")');
    expect(code).toContain("isEntitlementDenied(e)");
    expect(code).toContain("throw e;");
  });

  it("renders the denied surface with the Free claim path", () => {
    const code = source();
    expect(code).toContain("<AccessDenied orgSlug={orgSlug} />");
    expect(code).toContain("ClaimFreeRosterBuilderCard");
  });

  it("renders the workspace with the tool title for entitled orgs", () => {
    const code = source();
    expect(code).toContain("<RosterBuilderWorkspace />");
    expect(code).toContain("Tournament Roster & Slot Builder");
    expect(code).toContain("copy the final list");
  });

  it("never trusts client-supplied organization identity", () => {
    const code = source();
    expect(code).not.toMatch(/searchParams/);
    expect(code).not.toMatch(/organizationId.*=.*body|body.*organizationId/i);
    expect(code).not.toContain("headers()");
  });

  it("carries SEO metadata without dashboard indexing changes", () => {
    const code = source();
    expect(code).toContain("Tournament Roster & Slot Builder — MicroNest");
    expect(code).toContain("copy a clean roster in seconds");
  });
});
