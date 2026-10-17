import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Showdown-02 — static guardrails for the ingestion scheduler.
 *
 * The workflow is configuration (GitHub Actions YAML), not application
 * code: these assertions pin the properties the automatic-update
 * experiment depends on without executing anything.
 */
function workflowText(): string {
  return readFileSync(join(process.cwd(), ".github/workflows/bgmi-tournaments-ingest.yml"), "utf8");
}

describe("bgmi-tournaments-ingest scheduler (Showdown-02)", () => {
  it("runs on the daily schedule without high-frequency polling", () => {
    const text = workflowText();
    expect(text).toContain('cron: "0 8 * * *"');
    expect(text).not.toMatch(/\*\/\d/);
  });

  it("schedules both BMSD and Showdown Grand Finals legs", () => {
    const text = workflowText();
    expect(text).toContain("tournament: bmsd-2026");
    expect(text).toContain("tournament: bgmi-showdown-2026");
    expect(text).toContain("stages: grand-finals");
    expect(text).toContain("fail-fast: false");
  });

  it("keeps manual dispatch with catalog-bounded parameters", () => {
    const text = workflowText();
    expect(text).toContain("workflow_dispatch");
    expect(text).toContain("/api/ingest/bgmi-tournaments?tournament=$TOURNAMENT&stages=$STAGES");
    expect(text).toContain("Authorization: Bearer $CRON_SECRET");
  });
});
