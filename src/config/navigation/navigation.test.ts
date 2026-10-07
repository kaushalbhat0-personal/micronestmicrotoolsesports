import { describe, expect, it } from "vitest";
import { getDashboardNav, getDashboardNavGroups, getLegacyNavLinkProps, dashboardNav } from "./index";

describe("Navigation", () => {
  it("org nav uses Campaigns label not Sponsor Sentinel", () => {
    const nav = getDashboardNav("acme");
    const labels = nav.map((n) => n.label);
    expect(labels).toContain("Campaigns");
    expect(labels).not.toContain("Sponsor Sentinel");
  });

  it("org nav uses Checks label (IA) not Scans", () => {
    const nav = getDashboardNav("acme");
    const labels = nav.map((n) => n.label);
    expect(labels).toContain("Checks");
    // Ensure old Scans label not present as nav item
    expect(labels).not.toContain("Scans");
  });

  it("Campaigns points to campaigns route", () => {
    const nav = getDashboardNav("my-org");
    const campaigns = nav.find((n) => n.label === "Campaigns");
    expect(campaigns?.href).toBe("/dashboard/my-org/sponsor-sentinel/campaigns");
  });

  it("Checks points to scans route", () => {
    const nav = getDashboardNav("my-org");
    const item = nav.find((n) => n.label === "Checks");
    expect(item?.href).toBe("/dashboard/my-org/sponsor-sentinel/scans");
  });

  it("Channels and Connections are distinct routes", () => {
    const nav = getDashboardNav("my-org");
    const channels = nav.find((n) => n.label === "Channels");
    const connections = nav.find((n) => n.label === "Connections");
    expect(channels?.href).toBe("/dashboard/my-org/channels");
    expect(connections?.href).toBe("/dashboard/my-org/connections");
    expect(channels?.href).not.toBe(connections?.href);
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

  it("ordering: Overview before Campaigns before Checks before Channels", () => {
    const nav = getDashboardNav("org1");
    const labels = nav.map((n) => n.label);
    const overviewIdx = labels.indexOf("Overview");
    const campaignsIdx = labels.indexOf("Campaigns");
    const checkIdx = labels.indexOf("Checks");
    const channelsIdx = labels.indexOf("Channels");
    expect(overviewIdx).toBeLessThan(campaignsIdx);
    expect(campaignsIdx).toBeLessThan(checkIdx);
    expect(checkIdx).toBeLessThan(channelsIdx);
  });

  // RCCF-SPONSOR-FINAL-02: legacy Coming-Soon controls must not navigate.
  it("coming-soon nav items expose no live route href", () => {
    const nav = getDashboardNav("org1");
    const future = nav.filter((n) => n.comingSoon);
    expect(future.length).toBeGreaterThan(0);
    for (const item of future) {
      expect(item.href).toBe("#");
      expect(item.href).not.toContain("scrim-matchmaker");
      expect(item.href).not.toContain("vod-clipper");
      expect(item.href).not.toContain("roster-sentinel");
    }
  });

  it("available nav items keep live route hrefs", () => {
    const nav = getDashboardNav("my-org");
    const live = nav.filter((n) => !n.comingSoon);
    expect(live.length).toBeGreaterThan(0);
    for (const item of live) {
      expect(item.href).not.toBe("#");
    }
  });

  it("legacy coming-soon link props disable navigation", () => {
    const nav = getDashboardNav("org1");
    const future = nav.filter((n) => n.comingSoon);
    for (const item of future) {
      const props = getLegacyNavLinkProps(item);
      expect(props.href).toBe("#");
      expect(props.ariaDisabled).toBe(true);
      expect(props.shouldPreventDefault).toBe(true);
    }
  });

  it("legacy available link props preserve navigation", () => {
    const nav = getDashboardNav("my-org");
    const campaigns = nav.find((n) => n.label === "Campaigns");
    expect(campaigns).toBeDefined();
    const props = getLegacyNavLinkProps(campaigns!);
    expect(props.href).toBe("/dashboard/my-org/sponsor-sentinel/campaigns");
    expect(props.ariaDisabled).toBeUndefined();
    expect(props.shouldPreventDefault).toBe(false);
  });

  it("coming-soon group survives as disabled indication", () => {
    const groups = getDashboardNavGroups("org1");
    const coming = groups.find((g) => g.label === "Coming soon");
    expect(coming).toBeDefined();
    expect(coming!.items.length).toBeGreaterThan(0);
    expect(coming!.items.every((i) => i.comingSoon)).toBe(true);
  });
});
