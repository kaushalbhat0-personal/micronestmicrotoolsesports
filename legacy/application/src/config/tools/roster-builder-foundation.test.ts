import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS, getToolBySlug } from "@/config/app/tools";
import { MARKETING_TOOLS, getMarketingTool } from "@/config/marketing/tools";
import { getToolFreePolicy } from "@/config/tools/policy";
import { freeTierByMarketingSlug, freeTierBySlug } from "@/config/marketing/free-tiers";
import { coveredToolSlugs } from "@/lib/purchase/plan-guidance";
import sitemap from "@/app/sitemap";
import {
  ROSTER_BUILDER_TOOL_SLUG,
  ROSTER_BUILDER_PAID_SOURCES,
} from "@/server/services/roster-builder-policy";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Roster Builder foundation (RCCF-ROSTER-SLOT-IMPLEMENTATION-01).
 * Registry + Free-policy only: no parser, UI, routes, DB tables, or share.
 */
describe("roster-builder foundation — registry + free policy", () => {
  it("internal slug exists in the app registry with the future dashboard href", () => {
    expect(ROSTER_BUILDER_TOOL_SLUG).toBe("roster-builder");
    const tool = getToolBySlug("roster-builder");
    expect(tool?.name).toBe("Tournament Roster & Slot Builder");
    expect(tool?.href).toBe("/dashboard/roster-builder");
    expect(tool?.icon).toBe("ClipboardList");
    expect(tool?.comingSoon ?? false).toBe(false);
    expect(TOOLS.map((t) => t.slug)).toContain("roster-builder");
  });

  it("marketing slug maps to the internal slug with T09 metadata", () => {
    const marketing = getMarketingTool("tournament-roster-builder");
    expect(marketing?.internalSlug).toBe("roster-builder");
    expect(marketing?.name).toBe("Tournament Roster & Slot Builder");
    expect(marketing?.number).toBe("T09");
    expect(marketing?.status).toBe("available");
    expect(marketing?.seoTitle).toContain("Tournament Roster & Slot Builder");
    expect(marketing?.seoDescription.length).toBeGreaterThan(0);
    expect(MARKETING_TOOLS.map((t) => t.slug)).toContain("tournament-roster-builder");
  });

  it("marketing availability resolves through the canonical mapping", () => {
    expect(MARKETING_TOOLS.find((t) => t.slug === "tournament-roster-builder")?.internalSlug).toBe(
      "roster-builder",
    );
  });

  it("Free policy is org-scoped, claimable, and unlimited (empty limits)", () => {
    const policy = getToolFreePolicy("roster-builder");
    expect(policy?.toolSlug).toBe("roster-builder");
    expect(policy?.scope).toBe("org");
    expect(policy?.userGrantable).toBe(false);
    expect(policy?.freeEnabled).toBe(true);
    expect(policy?.claimable).toBe(true);
    expect(policy?.limits).toEqual({});
  });

  it("unknown slugs fail closed in the policy registry", () => {
    expect(getToolFreePolicy("roster-builder-typo")).toBeNull();
    expect(getToolFreePolicy("all-access")).toBeNull();
  });

  it("Free-tier marketing copy is unlimited and resolves by both slugs", () => {
    expect(freeTierBySlug("roster-builder")?.badge).toBe("Free forever");
    expect(freeTierBySlug("roster-builder")?.allowance).toMatch(/Unlimited/i);
    expect(freeTierByMarketingSlug("tournament-roster-builder")?.slug).toBe("roster-builder");
  });

  it("paid-source discriminator never includes free", () => {
    expect(ROSTER_BUILDER_PAID_SOURCES.has("free")).toBe(false);
    for (const source of ["subscription", "manual", "promo"]) {
      expect(ROSTER_BUILDER_PAID_SOURCES.has(source)).toBe(true);
    }
  });

  it("All Access covers roster-builder with no unrelated change", () => {
    expect(coveredToolSlugs("all-access-monthly")).toContain("roster-builder");
    expect(coveredToolSlugs("all-access-yearly")).toContain("roster-builder");
    // Existing tools remain covered.
    for (const slug of ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker", "payout-tracker"]) {
      expect(coveredToolSlugs("all-access-monthly")).toContain(slug);
    }
  });

  it("sitemap exposes the public marketing route automatically", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    expect(urls).toContain("/tools/tournament-roster-builder");
  });

  it("no dashboard or share route leaks into the public sitemap", async () => {
    const urls = (await sitemap()).map((e) => new URL(e.url, "http://localhost:3000").pathname);
    for (const url of urls) {
      expect(url.startsWith("/dashboard")).toBe(false);
      expect(url.startsWith("/share")).toBe(false);
    }
  });

  it("launch migration registers the tool catalog row only (no plans, RLS, or RPC)", () => {
    const migration = src("supabase/migrations/20251106000001_roster_builder_launch.sql");
    expect(migration).toContain("'roster-builder'");
    expect(migration).toMatch(/insert into public\.tools/);
    expect(migration).not.toMatch(/insert into public\.plans/);
    expect(migration).not.toMatch(/row level security|create policy|create or replace function/i);
  });

  it("claim dispatch routes roster-builder to its policy grant", () => {
    const dispatch = src("src/server/services/tool-claim.ts");
    expect(dispatch).toContain("ROSTER_BUILDER_TOOL_SLUG");
    expect(dispatch).toContain("ensureFreeRosterBuilderGrant");
  });

  it("existing tools remain unchanged in every registry", () => {
    expect(getToolBySlug("prize-splitter")?.href).toBe("/dashboard/prize-splitter");
    expect(getToolBySlug("payout-tracker")?.href).toBe("/dashboard/payout-tracker");
    expect(getMarketingTool("prize-pool-splitter")?.internalSlug).toBe("prize-splitter");
    expect(getMarketingTool("prize-payout-tracker")?.internalSlug).toBe("payout-tracker");
    expect(getToolFreePolicy("prize-splitter")?.limits).toEqual({});
    expect(getToolFreePolicy("payout-tracker")?.limits.publishedTrackersPerMonth).toBe(1);
  });
});
