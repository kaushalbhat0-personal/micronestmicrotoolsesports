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

  it("fails closed on missing secrets without printing values", () => {
    const text = workflowText();
    expect(text).toMatch(/APP_URL secret is not configured/);
    expect(text).toMatch(/CRON_SECRET secret is not configured/);
    // Secret values must never be echoed; only presence-check messages and
    // the safe HTTP status / endpoint response body are printed.
    expect(text).not.toMatch(/echo[^#\n]*\$CRON_SECRET/);
    expect(text).not.toMatch(/echo[^#\n]*\$APP_URL/);
  });

  it("gates success on the response body contract, not the status alone", () => {
    const text = workflowText();
    // The endpoint returns 200 with { ok: false } on stage failure, so the
    // workflow must assert ok:true and failed==0 and exit non-zero otherwise.
    expect(text).toMatch(/ok.*True|body\.get\(["']ok["']\)/);
    expect(text).toMatch(/failed/);
    expect(text).toContain("exit 1");
    // Non-2xx transport failures (auth, unreachable endpoint) also fail.
    expect(text).toMatch(/HTTP|\bhttp_code\b/);
  });

  it("treats an unchanged source revision as healthy (no false alerts)", () => {
    const text = workflowText();
    // Success is defined as ok:true with zero failures — never as
    // "source revision changed". A no-op run stays green.
    expect(text).not.toMatch(/revision.*changed|source.*changed/i);
    expect(text).toMatch(/unchanged|ok:true/i);
  });
});
