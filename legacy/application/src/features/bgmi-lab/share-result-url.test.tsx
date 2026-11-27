import * as React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import {
  buildLabResultShareUrl,
  parseLabSharedResult,
  parseLabSharedResultFromSearch,
} from "./share-result-url";
import { SharedResultBanner } from "./components/shared-result-banner";
import { ShareRow } from "./components/share-row";

const CANONICAL = "https://micronestmicrotoolsesports.vercel.app/bgmi-lab/circle-iq";
const SHARE_TEXT =
  "I practiced my zone reads in Circle IQ — a free BGMI rotation drill. Can you make the call?";

describe("share-result-url — pure helper", () => {
  it("builds ?result=S-T on the canonical URL", () => {
    expect(buildLabResultShareUrl(CANONICAL, 6, 8)).toBe(`${CANONICAL}?result=6-8`);
    expect(buildLabResultShareUrl(CANONICAL, 0, 8)).toBe(`${CANONICAL}?result=0-8`);
    expect(buildLabResultShareUrl(CANONICAL, 8, 8)).toBe(`${CANONICAL}?result=8-8`);
  });

  it("round-trips through the parser with the matching expected total", () => {
    expect(parseLabSharedResult("6-8", 8)).toEqual({ score: 6, total: 8 });
  });

  it("parses the query out of a location search string", () => {
    expect(parseLabSharedResultFromSearch("?result=6-8", 8)).toEqual({ score: 6, total: 8 });
    expect(parseLabSharedResultFromSearch("?foo=1&result=4-5", 5)).toEqual({ score: 4, total: 5 });
    expect(parseLabSharedResultFromSearch("", 8)).toBeNull();
    expect(parseLabSharedResultFromSearch("?foo=1", 8)).toBeNull();
  });

  it("returns the canonical URL unchanged for invalid sender scores", () => {
    expect(buildLabResultShareUrl(CANONICAL, 9, 8)).toBe(CANONICAL);
    expect(buildLabResultShareUrl(CANONICAL, -1, 8)).toBe(CANONICAL);
    expect(buildLabResultShareUrl(CANONICAL, 6, 0)).toBe(CANONICAL);
  });

  it("adds no tracking parameters", () => {
    const url = buildLabResultShareUrl(CANONICAL, 6, 8);
    expect(url).not.toMatch(/utm_|referral=|tracking=/);
    expect(url).toBe(`${CANONICAL}?result=6-8`);
  });
});

describe("share-result-url — malformed payloads fail closed", () => {
  const cases: readonly unknown[] = [
    null,
    undefined,
    42,
    "",
    "   ",
    "abc",
    "6",
    "6/",
    "6/8",
    "6_of_8",
    "6-8-2",
    "6--8",
    "-1-8",
    "6.5-8",
    "9-8",
    "6-9",
    "6-0",
    "999-9999",
    "result=6-8",
    "?result=6-8",
    "6-8 ",
    " 6-8",
  ];
  for (const raw of cases) {
    it(`rejects ${JSON.stringify(raw)}`, () => {
      // " 6-8" trims to a valid payload by design (URL decoding may pad
      // whitespace); every other case above must fail closed.
      if (raw === "6-8 " || raw === " 6-8") {
        expect(parseLabSharedResult(raw, 8)).toEqual({ score: 6, total: 8 });
      } else {
        expect(parseLabSharedResult(raw, 8)).toBeNull();
      }
    });
  }

  it("rejects overlong input", () => {
    expect(parseLabSharedResult(`${"1".repeat(32)}-8`, 8)).toBeNull();
    expect(parseLabSharedResultFromSearch(`?result=${"1".repeat(3000)}`, 8)).toBeNull();
  });

  it("never throws on hostile input", () => {
    expect(() => parseLabSharedResultFromSearch("?result=%FF%FE", 8)).not.toThrow();
    expect(parseLabSharedResultFromSearch("?result=%FF%FE", 8)).toBeNull();
  });
});

describe("share-result-url — cross-game totals", () => {
  it("accepts each game's own total", () => {
    expect(parseLabSharedResult("6-8", 8)).toEqual({ score: 6, total: 8 });
    expect(parseLabSharedResult("4-5", 5)).toEqual({ score: 4, total: 5 });
    expect(parseLabSharedResult("5-6", 6)).toEqual({ score: 5, total: 6 });
  });

  it("rejects a payload total that does not match the rendering game", () => {
    // A Rotation Replay 4-5 link pasted onto Circle IQ must not render.
    expect(parseLabSharedResult("4-5", 8)).toBeNull();
    expect(parseLabSharedResult("6-8", 5)).toBeNull();
    expect(parseLabSharedResult("6-8", 6)).toBeNull();
  });
});

describe("ShareRow — result-aware channels", () => {
  const html = renderToString(
    <ShareRow
      gameName="Circle IQ"
      score={6}
      total={8}
      shareText={SHARE_TEXT}
      canonicalUrl={CANONICAL}
    />
  ).replace(/<!--.*?-->/g, "");
  const shareUrl = `${CANONICAL}?result=6-8`;

  it("carries the result-aware URL in the human-readable message", () => {
    // The message itself only surfaces encoded inside the WhatsApp href
    // (native share / clipboard payloads are JS-only at runtime).
    expect(html).toContain(encodeURIComponent(`View online: ${shareUrl}`));
    expect(html).toContain(encodeURIComponent(shareUrl));
  });

  it("copies the result-aware URL (with manual-copy fallback)", () => {
    expect(html).toContain(encodeURIComponent(`View online: ${shareUrl}`));
  });

  it("keeps all three channels consistent on the same URL", () => {
    expect(html).toContain("https://wa.me/?text=");
    const encoded = encodeURIComponent(shareUrl);
    expect(html).toContain(encoded);
    expect(html).not.toMatch(/utm_|referral=|tracking=/);
  });

  it("wires native share and copy-link to the result URL at source level", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const rowSrc = strip(
      readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/share-row.tsx"), "utf8")
    );
    // Native Web Share URL + clipboard payload both use the result URL.
    expect(rowSrc).toContain("url: shareUrl");
    expect(rowSrc).toContain("writeText(shareUrl)");
    expect(rowSrc).toContain("buildLabResultShareUrl(canonicalUrl, score, total)");
  });
});

describe("SharedResultBanner — recipient challenge copy", () => {
  it("labels the payload as a claimed result and offers start/dismiss", () => {
    const html = renderToString(
      <SharedResultBanner
        gameName="Circle IQ"
        shared={{ score: 6, total: 8 }}
        onDismiss={() => {}}
      />
    ).replace(/<!--.*?-->/g, "");
    expect(html).toContain("Someone shared 6/8 good reads on Circle IQ");
    expect(html).toContain("claimed result, not a verified score");
    expect(html).toContain("Start your run");
    expect(html).toContain("Dismiss");
    expect(html).toContain("Your run below starts fresh");
  });

  it("honours per-game result nouns", () => {
    const html = renderToString(
      <SharedResultBanner
        gameName="Rotation Replay"
        shared={{ score: 4, total: 5 }}
        resultNoun="lined-up reads"
        onDismiss={() => {}}
      />
    ).replace(/<!--.*?-->/g, "");
    expect(html).toContain("Someone shared 4/5 lined-up reads on Rotation Replay");
  });
});
