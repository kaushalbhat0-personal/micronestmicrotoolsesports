import { describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadTextFile } from "./download";
import { resolveShareFontBody, resolveShareFontDisplay } from "./fonts";
import { pngFilename, sanitizeFilename } from "./sanitize-filename";
import { renderShareCardBlob } from "./render";
import { ShareRenderError, type ShareCanvas, type ShareCardSpec } from "./types";

const sampleSpec: ShareCardSpec = {
  tone: "tool",
  eyebrow: "Prize Pool",
  title: "Tournament Split",
  subtitle: "INR planning breakdown",
  rows: [
    { label: "Total", value: "₹1,00,000" },
    { label: "1st", value: "₹50,000" },
  ],
  blocks: ["1st — ₹50,000", "2nd — ₹30,000"],
  disclaimer: "Planning aid only — not a payment.",
  destinationLabel: "micronestmicrotoolsesports.vercel.app/tools",
  filenameBase: "prize-pool-demo",
};

function mockCanvas(options?: { failContext?: boolean; emptyBlob?: boolean }): ShareCanvas {
  const calls: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "square",
    font: "",
    textBaseline: "alphabetic",
    fillRect: () => {
      calls.push("fillRect");
    },
    stroke: () => {
      calls.push("stroke");
    },
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    quadraticCurveTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    fillText: () => undefined,
    measureText: (text: string) => ({ width: text.length * 10 }),
  } as unknown as CanvasRenderingContext2D;

  return {
    width: 1080,
    height: 1080,
    getContext: (id: "2d") => {
      if (id !== "2d" || options?.failContext) {
        return null;
      }
      return ctx;
    },
    toBlob: (cb) => {
      if (options?.emptyBlob) {
        cb(null);
        return;
      }
      cb(new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }));
    },
  };
}

describe("resolveShareFonts (node fallback)", () => {
  it("returns system fallbacks when document is unavailable", () => {
    expect(resolveShareFontDisplay().toLowerCase()).toContain("oswald");
    expect(resolveShareFontBody().toLowerCase()).toContain("geist");
  });
});

describe("sanitizeFilename", () => {
  it("sanitizes unsafe characters and lowercases", () => {
    expect(sanitizeFilename("Prize Pool / 1st!!")).toBe("prize-pool-1st");
    expect(pngFilename("Team@@Name")).toBe("team-name.png");
  });

  it("falls back when empty", () => {
    expect(sanitizeFilename("???")).toBe("fragix-share");
  });
});

describe("renderShareCardBlob", () => {
  it("returns a non-empty PNG blob", async () => {
    const blob = await renderShareCardBlob(sampleSpec, () => mockCanvas());
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("image/png");
  });

  it("handles long titles without throwing", async () => {
    const blob = await renderShareCardBlob(
      {
        ...sampleSpec,
        title: "A".repeat(120),
        subtitle: "B".repeat(120),
        rows: [{ label: "Note", value: "C".repeat(200) }],
      },
      () => mockCanvas(),
    );
    expect(blob.size).toBeGreaterThan(0);
  });

  it("throws when 2d context is missing", async () => {
    await expect(
      renderShareCardBlob(sampleSpec, () => mockCanvas({ failContext: true })),
    ).rejects.toBeInstanceOf(ShareRenderError);
  });

  it("throws when encoding yields an empty blob", async () => {
    await expect(
      renderShareCardBlob(sampleSpec, () => mockCanvas({ emptyBlob: true })),
    ).rejects.toBeInstanceOf(ShareRenderError);
  });
});

describe("downloadBlob", () => {
  it("creates an anchor download and revokes the object URL", () => {
    const click = vi.fn();
    const revoke = vi.fn();
    const createObjectURL = vi.fn(() => "blob:mock");
    const appendChild = vi.fn();
    const removeChild = vi.fn();

    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: revoke });
    vi.stubGlobal("document", {
      createElement: () => ({
        href: "",
        download: "",
        rel: "",
        style: { display: "" },
        click,
      }),
      body: { appendChild, removeChild },
    });

    downloadBlob(new Blob([new Uint8Array([9])], { type: "image/png" }), "My Card!!");
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:mock");

    vi.unstubAllGlobals();
  });

  it("rejects empty blobs", () => {
    expect(() => downloadBlob(new Blob([]), "x")).toThrow(ShareRenderError);
  });
});

describe("downloadTextFile", () => {
  it("downloads a csv with sanitized name", () => {
    const click = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:csv",
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("document", {
      createElement: () => {
        const el: { href: string; download: string; rel: string; style: { display: string }; click: () => void } = {
          href: "",
          download: "",
          rel: "",
          style: { display: "" },
          click,
        };
        return el;
      },
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
    });
    downloadTextFile("Slot,Team,Player\n", "Roster Plan");
    expect(click).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
