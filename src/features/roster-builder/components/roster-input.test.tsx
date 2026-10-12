import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RosterInput, SAMPLE_ROSTER_INPUT } from "./roster-input";
import { parseRosterText } from "../services/parser";

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

function render(overrides?: Partial<React.ComponentProps<typeof RosterInput>>) {
  return rendered(
    <RosterInput
      value=""
      onChange={() => undefined}
      onLoadSample={() => undefined}
      onClear={() => undefined}
      delimiterMode="auto"
      onDelimiterModeChange={() => undefined}
      detectedLabel={null}
      capacityText="5"
      onCapacityTextChange={() => undefined}
      capacityError={null}
      {...overrides}
    />,
  );
}

describe("RosterInput", () => {
  it("answers what to paste: textarea, placeholder example, and format hint", () => {
    const html = render();
    expect(html).toContain('id="roster-paste"');
    expect(html).toContain("Registrations");
    expect(html).toContain("Alpha Esports,Player One");
    expect(html).toContain("tab");
    expect(html).toContain("Nothing leaves your browser");
  });

  it("offers Load sample and a disabled Clear when empty", () => {
    const html = render();
    expect(html).toContain("Load sample");
    expect(html).toContain("Clear");
    expect(html).toContain("disabled");
  });

  it("enables Clear once text exists", () => {
    const html = render({ value: "Alpha\tRahul" });
    expect(html).not.toContain("disabled=\"\"");
  });

  it("shows the detected delimiter and capacity controls with labels", () => {
    const html = render({ detectedLabel: "Comma" });
    expect(html).toContain("Detected: Comma");
    expect(html).toContain("Players per team");
    expect(html).toContain("Delimiter");
  });

  it("surfaces capacity errors as an alert without quotas language", () => {
    const html = render({ capacityText: "99", capacityError: "Enter a whole team size between 1 and 30." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Using 5 instead");
  });

  it("sample input parses through the real parser with expected stats", () => {
    const parsed = parseRosterText(SAMPLE_ROSTER_INPUT);
    if (!parsed.ok) throw new Error("sample must parse");
    expect(parsed.stats.teams).toBe(3);
    expect(parsed.stats.players).toBe(8);
    expect(SAMPLE_ROSTER_INPUT).not.toMatch(/98765|@example|real/i);
  });

  it("never imports server or storage capabilities", () => {
    const source = readFileSync(join(process.cwd(), "src/features/roster-builder/components/roster-input.tsx"), "utf8");
    expect(source).not.toMatch(/supabase|localStorage|sessionStorage|fetch\(|eval\(|dangerouslySetInnerHTML/);
    expect(source).not.toMatch(/console\.(log|info|debug)/);
  });
});
