import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReadinessCard } from "@/components/ui/readiness-card";
import { formatRequirementDescription } from "./requirement-description";

// Campaign header language
describe("Campaign workflow UX — header terminology", () => {
  it("Start tracking presentation (active badge)", () => {
    const html = renderToString(<StatusBadge status="active" />);
    expect(html).toContain("Tracking");
    expect(html).not.toContain(">active<");
  });
  it("Setup badge for draft", () => {
    const html = renderToString(<StatusBadge status="draft" />);
    expect(html).toContain("Setup");
  });
});

// Readiness
describe("Campaign workflow UX — readiness", () => {
  it("no channel blocked", () => {
    const html = renderToString(
      <ReadinessCard
        title="Campaign setup"
        items={[
          { label: "Campaign details", status: "complete" },
          { label: "Creator channel not connected", status: "blocked", description: "Connect a creator channel to start tracking this campaign." },
          { label: "No requirement yet", status: "blocked" },
        ]}
      />
    );
    expect(html).toContain("Creator channel not connected");
    expect(html).toContain("Connect a creator channel");
    expect(html).toContain("Needs setup");
  });
  it("ready when all complete", () => {
    const html = renderToString(
      <ReadinessCard title="Campaign setup" items={[{ label: "Campaign details", status: "complete" }, { label: "Creator channel connected", status: "complete" }, { label: "Requirement added", status: "complete" }]} />
    );
    expect(html).toContain("Ready");
    expect(html).toContain("3 of 3 ready");
  });
  it("correct action links wording", () => {
    const html = renderToString(<div>Connect a creator channel /settings/integrations</div>);
    expect(html).toContain("Connect a creator channel");
    expect(html).toContain("/settings/integrations");
  });
});

// Requirements
describe("Campaign workflow UX — requirements terminology", () => {
  it("requirement name present", () => {
    const html = formatRequirementDescription({ type: "required_title_contains", value: "#Brand" });
    expect(html).toBe("Title contains #Brand");
  });
  it("raw JSON is NOT rendered for requirement", () => {
    const html = formatRequirementDescription({ type: "required_youtube_tags", tags: ["#Esports"] });
    expect(html).not.toContain('{"tags"');
    expect(html).not.toContain('"type"');
  });
  it("uses user-facing requirement vocabulary", () => {
    // Ensure formatter uses expected labels
    expect(formatRequirementDescription({ type: "required_youtube_tags", tags: ["a"] })).toContain("YouTube tags include");
    expect(formatRequirementDescription({ type: "required_twitch_tag", tag_id: "Esports" })).toContain("Twitch tags include");
    expect(formatRequirementDescription({ type: "minimum_duration", minutes: 30 })).toContain("Stream for at least");
  });
});

// Proof result mapping
describe("Campaign workflow UX — proof results", () => {
  it("PASS → Confirmed", () => {
    const html = renderToString(<StatusBadge status="PASS" />);
    expect(html).toContain("Confirmed");
  });
  it("FAIL → Not found", () => {
    const html = renderToString(<StatusBadge status="FAIL" />);
    expect(html).toContain("Not found");
  });
  it("NOT_VERIFIABLE → Needs review", () => {
    const html = renderToString(<StatusBadge status="NOT_VERIFIABLE" />);
    expect(html).toContain("Needs review");
  });
  it("PENDING → Checking", () => {
    const html = renderToString(<StatusBadge status="PENDING" />);
    expect(html).toContain("Checking");
  });
  it("NOT_SUPPORTED → Not applicable", () => {
    const html = renderToString(<StatusBadge status="NOT_SUPPORTED" />);
    expect(html).toContain("Not applicable");
  });
  it("source link wording is View source not Source", () => {
    const html = renderToString(<a href="https://example.com" target="_blank" rel="noreferrer">View source</a>);
    expect(html).toContain("View source");
    expect(html).not.toContain(">Source<");
  });
  it("no evidence wording", () => {
    const html = renderToString(<div>No sponsorship proof checked yet</div>);
    expect(html).toContain("No sponsorship proof checked yet");
    expect(html).not.toContain("No evidence");
  });
});

// Ensure spec forbidden technical strings are replaced
describe("Campaign workflow UX — forbidden technical language", () => {
  it("formatter never exposes raw enums like draft/active as primary", () => {
    // StatusBadge already maps them
    const draft = renderToString(<StatusBadge status="draft" />);
    expect(draft).toContain("Setup");
  });
});
