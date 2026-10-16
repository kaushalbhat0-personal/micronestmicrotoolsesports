// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Provenance } from "./provenance";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Source attribution wording (RCCF-META-PARSER-UX-03). User-facing labels —
 * same URLs, same distinction between official notes and dataset.
 */

const PROVENANCE = {
  sourceLabel: "Valve — Dota 2",
  datasetLabel: "OpenDota dotaconstants",
  datasetUrl: "https://github.com/odota/dotaconstants",
  license: "MIT License, © 2017 The OpenDota Project",
};

async function renderProvenance(revision: number | null = 3) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <Provenance
        sourceUrl="https://www.dota2.com/patches/7.41"
        patchVersion="7.41"
        gameName="Dota 2"
        provenance={PROVENANCE}
        revision={revision}
      />
    );
  });
  return {
    container,
    cleanup: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("provenance wording", () => {
  it("uses user-facing source labels with unchanged URLs", async () => {
    const { container, cleanup } = await renderProvenance();
    const text = container.textContent ?? "";
    expect(text).toContain("Official patch notes:");
    expect(text).toContain("Data:");
    expect(text).not.toContain("Canonical patch source");
    expect(text).not.toContain("Structured dataset");
    const links = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(links).toContain("https://www.dota2.com/patches/7.41");
    expect(links).toContain("https://github.com/odota/dotaconstants");
    cleanup();
  });

  it("keeps revision as secondary source detail, never a primary fact", async () => {
    const { container, cleanup } = await renderProvenance(3);
    expect(container.textContent).toContain("Source details · update 3");
    expect(container.textContent).not.toContain("Revision");
    cleanup();
  });

  it("hides the revision line entirely when absent", async () => {
    const { container, cleanup } = await renderProvenance(null);
    expect(container.textContent).not.toContain("Source details");
    expect(container.textContent).not.toContain("Revision");
    cleanup();
  });
});
