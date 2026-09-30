import { describe, expect, it } from "vitest";
import { getDashboardNav, dashboardNav } from "./index";

describe("Navigation", () => {
  it("org nav uses Campaigns label not Sponsor Sentinel", () => {
    const nav = getDashboardNav("acme");
    const labels = nav.map((n) => n.label);
    expect(labels).toContain("Campaigns");
    expect(labels).not.toContain("Sponsor Sentinel");
  });

  it("org nav uses Check History label not Scans", () => {
    const nav = getDashboardNav("acme");
    const labels = nav.map((n) => n.label);
    expect(labels).toContain("Check History");
    // Ensure old Scans label not present as nav item
    expect(labels).not.toContain("Scans");
  });

  it("Campaigns points to campaigns route", () => {
    const nav = getDashboardNav("my-org");
    const campaigns = nav.find((n) => n.label === "Campaigns");
    expect(campaigns?.href).toBe("/dashboard/my-org/sponsor-sentinel/campaigns");
  });

  it("Check History points to scans route", () => {
    const nav = getDashboardNav("my-org");
    const item = nav.find((n) => n.label === "Check History");
    expect(item?.href).toBe("/dashboard/my-org/sponsor-sentinel/scans");
  });

  it("Creator Channels and Integrations point to settings/integrations", () => {
    const nav = getDashboardNav("my-org");
    const channels = nav.find((n) => n.label === "Creator Channels");
    const integrations = nav.find((n) => n.label === "Integrations");
    expect(channels?.href).toBe("/dashboard/my-org/settings/integrations");
    expect(integrations?.href).toBe("/dashboard/my-org/settings/integrations");
  });

  it("future tools remain subordinate with Soon", () => {
    const nav = getDashboardNav("org1");
    const future = nav.filter((n) => n.comingSoon);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((n) => n.label !== "Campaigns")).toBe(true);
    const campaigns = nav.find((n) => n.label === "Campaigns");
    expect(campaigns?.comingSoon).toBeFalsy();
  });

  it("Organizations remains accessible as global", () => {
    const nav = getDashboardNav("org1");
    expect(nav.some((n) => n.label === "Organizations" && n.href === "/dashboard/organizations")).toBe(true);
    expect(dashboardNav.some((n) => n.label === "Organizations")).toBe(true);
  });

  it("ordering: Overview before Campaigns before Check History before Channels", () => {
    const nav = getDashboardNav("org1");
    const labels = nav.map((n) => n.label);
    const overviewIdx = labels.indexOf("Overview");
    const campaignsIdx = labels.indexOf("Campaigns");
    const checkIdx = labels.indexOf("Check History");
    const channelsIdx = labels.indexOf("Creator Channels");
    expect(overviewIdx).toBeLessThan(campaignsIdx);
    expect(campaignsIdx).toBeLessThan(checkIdx);
    expect(checkIdx).toBeLessThan(channelsIdx);
  });
});
