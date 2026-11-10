import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RosterOutput } from "./roster-output";
import { parseRosterText } from "../services/parser";
import { buildWorkingModel } from "../services/slots";
import { buildCopyText, buildCsv, buildPrintModel } from "../services/output";

function model(text: string) {
  const parsed = parseRosterText(text);
  if (!parsed.ok) throw new Error("fixture must parse");
  return buildWorkingModel(parsed.rows).teams;
}

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function render(text: string, unresolvedCount = 0) {
  const teams = model(text);
  return {
    html: rendered(
      <RosterOutput
        copyText={buildCopyText(teams, { unresolvedCount })}
        csvText={buildCsv(teams)}
        printModel={buildPrintModel(teams)}
        teams={teams}
        unresolvedCount={unresolvedCount}
        onReset={() => undefined}
      />,
    ),
    teams,
  };
}

describe("RosterOutput", () => {
  it("previews exactly the domain copy text", () => {
    const { html, teams } = render("Alpha\tRahul\nBravo\tKaran");
    const expected = buildCopyText(teams, { unresolvedCount: 0 });
    expect(html).toContain("Team 1 — Alpha");
    expect(html).toContain("1. Rahul");
    expect(textOf(html)).toContain(expected);
  });

  it("communicates unresolved blocking work prominently", () => {
    const { html } = render("Alpha\tRahul\n\tKaran", 1);
    expect(html).toContain("Unresolved: 1 blocking issue");
    expect(html).toContain('role="alert"');
    expect(html).toContain("1 unresolved issue");
  });

  it("stays quiet when clean", () => {
    const { html } = render("Alpha\tRahul");
    expect(html).not.toContain("Unresolved");
    expect(html).toContain("Copy roster");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Print");
    expect(html).toContain("Start over");
  });

  it("renders hostile names as inert text (escaped, never elements)", () => {
    const { html } = render("Alpha\t<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("never exposes contacts in preview, print sheet, or buttons", () => {
    const { html } = render("Alpha\tRahul\tSECRET-991");
    expect(html).not.toContain("SECRET-991");
  });

  it("keeps over-cap names whole in preview and print", () => {
    const long = `Team ${"X".repeat(80)}`;
    const { html } = render(`${long}\tRahul`);
    expect(html).toContain(long);
  });

  it("uses no server actions or telemetry", () => {
    const source = readFileSync(join(process.cwd(), "src/features/roster-builder/components/roster-output.tsx"), "utf8");
    expect(source).not.toMatch(/"use server"|supabase|analytics|telemetry|fetch\(/);
    expect(source).not.toMatch(/console\.(log|info|debug)/);
  });

  it("offers WhatsApp sharing with a review notice and no contacts", () => {
    const { html } = render("Alpha\tRahul\tSECRET-991");
    // Collapsed affordance renders server-side; the review notice lives in
    // the expanded editor (client interaction) — assert both levels.
    expect(html).toContain("Share on WhatsApp");
    expect(html).not.toContain("SECRET-991");
    const source = readFileSync(join(process.cwd(), "src/features/roster-builder/components/roster-output.tsx"), "utf8");
    expect(source).toContain("Review before sharing");
  });
});
