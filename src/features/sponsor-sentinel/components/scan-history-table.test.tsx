import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ScanHistoryTable } from "./scan-history-table";
import type { ScanHistoryItem } from "../services/scan-history";

function makeItem(overrides: { scan?: Partial<ScanHistoryItem["scan"]>; evidenceCount?: number; evaluationSummary?: Record<string, number>; campaignName?: string | null } = {}): ScanHistoryItem {
  return {
    scan: {
      id: "scan-12345678-aaaa",
      organization_id: "org-a",
      campaign_id: "camp-1",
      platform: "twitch",
      status: "success",
      started_at: "2026-03-10T14:00:00Z",
      completed_at: "2026-03-10T14:05:00Z",
      scanner_version: "v1",
      error_code: null,
      error_message: null,
      created_at: "2026-03-10T14:05:00Z",
      ...(overrides.scan ?? {}),
    } as ScanHistoryItem["scan"],
    campaignName: overrides.campaignName ?? "Campaign A",
    evidenceCount: overrides.evidenceCount ?? 2,
    evaluationSummary: overrides.evaluationSummary ?? { PASS: 1, FAIL: 1 },
  } as ScanHistoryItem;
}

describe("ScanHistoryTable", () => {
  it("renders populated scan list with status and evidence", () => {
    const items = [makeItem(), makeItem({ scan: { id: "scan-2", status: "failed" } as never, evidenceCount: 0, evaluationSummary: {} })];
    const html = renderToString(<ScanHistoryTable items={items} />);
    expect(html).toContain("scan-12");
    expect(html).toContain("success");
    expect(html).toContain("failed");
    expect(html).toContain("PASS");
    expect(html).toContain("FAIL");
  });

  it("status not color-only: has accessible aria-label", () => {
    const html = renderToString(<ScanHistoryTable items={[makeItem()]} />);
    expect(html).toContain('aria-label="Confirmed: success"');
  });

  it("empty evaluation summary shows —", () => {
    const html = renderToString(<ScanHistoryTable items={[makeItem({ evaluationSummary: {} })]} />);
    expect(html).toContain("—");
  });

  it("table has accessible headers", () => {
    const html = renderToString(<ScanHistoryTable items={[makeItem()]} />);
    expect(html).toContain("Status");
    expect(html).toContain("Campaign");
  });
});
