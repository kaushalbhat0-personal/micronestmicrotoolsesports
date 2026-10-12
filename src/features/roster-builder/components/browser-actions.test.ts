import { describe, expect, it, vi, afterEach } from "vitest";
import { copyTextToClipboard, downloadTextFile } from "./browser-actions";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyTextToClipboard", () => {
  it("returns false with no clipboard available (never throws)", async () => {
    await expect(copyTextToClipboard("Team 1 — Alpha")).resolves.toBe(false);
  });

  it("uses the Clipboard API when present and never logs content", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTextToClipboard("Team 1 — Alpha")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("Team 1 — Alpha");
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});

describe("downloadTextFile", () => {
  it("returns false outside a browser (never throws)", () => {
    expect(downloadTextFile("tournament-roster.csv", "a,b", "text/csv")).toBe(false);
  });
});
