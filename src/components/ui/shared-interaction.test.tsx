import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { Button } from "./button";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Shared interaction layer (RCCF-PLATFORM-MOTION-07, Phase A only).
 * Button press lives in the primitive; one opt-in card treatment exists;
 * sheet/select enter-exit uses working custom keyframes (no dependency).
 */
describe("shared interaction layer", () => {
  it("defines panel keyframes and the interactive-card utility with motion tokens", () => {
    const css = src("src/styles/globals.css");
    for (const token of [
      "@keyframes nest-sheet-in",
      "@keyframes nest-sheet-out",
      "@keyframes nest-fade-in",
      "@keyframes nest-fade-out",
      "@utility card-interactive",
      "var(--motion-nav, 220ms)",
      "var(--motion-micro, 180ms)",
    ]) {
      expect(css, `globals.css must contain ${token}`).toContain(token);
    }
  });

  it("covers the new motion in the global reduced-motion rule", () => {
    const css = src("src/styles/globals.css");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).toContain("transition-duration: 0.01ms");
    // Plain CSS transitions/animations (no inline styles) inherit the kill-switch.
    expect(css).not.toContain("card-interactive[data-reduced");
  });

  it("keeps reveal fill from overriding later hover transforms", () => {
    const css = src("src/styles/globals.css");
    // backwards (not both): end state equals natural styles, so retained
    // fill must not suppress card-interactive hover lift.
    expect(css).toContain("ease-out backwards");
  });

  it("gives every Button variant a shared subtle press state", () => {
    const code = src("src/components/ui/button.tsx");
    expect(code).toContain("active:translate-y-px");
    // One shared declaration — not duplicated per variant.
    expect(code.match(/active:translate-y-px/g)).toHaveLength(1);
    expect(code).toContain("focus-visible:ring-2");
    expect(code).toContain("disabled:pointer-events-none");
  });

  it("renders Button with press, focus, disabled, and loading behavior intact", () => {
    const html = renderToString(<Button>Save</Button>);
    expect(html).toContain("active:translate-y-px");
    expect(html).toContain("focus-visible:ring-2");
    const loading = renderToString(<Button loading>Save</Button>);
    expect(loading).toContain("disabled");
    expect(loading).toContain("animate-spin");
    const disabled = renderToString(<Button disabled>Save</Button>);
    expect(disabled).toContain("disabled");
  });

  it("repairs sheet/select enter-exit with working classes (no dead animation)", () => {
    const sheet = src("src/components/ui/sheet.tsx");
    expect(sheet).toContain("nest-sheet-overlay");
    expect(sheet).toContain("nest-sheet-content");
    expect(sheet).not.toContain("animate-in");
    expect(sheet).not.toContain("animate-out");
    const select = src("src/components/ui/select.tsx");
    expect(select).toContain("nest-select-content");
    expect(select).not.toContain("animate-in");
    expect(select).not.toContain("animate-out");
  });

  it("applies the interactive-card treatment only to clickable discovery surfaces", () => {
    expect(src("src/app/tools/page.tsx").match(/card-interactive/g)).toHaveLength(2);
    expect(src("src/app/(dashboard)/dashboard/page.tsx")).toContain("card-interactive");
    // Static/informational surfaces stay static.
    for (const path of [
      "src/app/pricing/pricing-client.tsx",
      "src/app/meta-parser/page.tsx",
      "src/app/meta-parser/[game]/page.tsx",
      "src/app/meta-parser/[game]/[version]/page.tsx",
      "src/components/marketing/homepage/toolbox-groups.tsx",
    ]) {
      expect(src(path), `${path} must stay static`).not.toContain("card-interactive");
    }
  });
});
