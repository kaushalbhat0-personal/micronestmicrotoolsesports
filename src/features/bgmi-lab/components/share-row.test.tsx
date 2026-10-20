import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { buildLabShareMessage, isShareAbort } from "../share-message";
import { ShareRow } from "./share-row";

const PROD_URL = "https://micronestmicrotoolsesports.vercel.app/bgmi-lab/circle-iq";
const SHARE_TEXT = "I practiced my zone reads in Circle IQ — a free BGMI rotation drill. Can you make the call?";

function message(score = 6): string {
  return buildLabShareMessage({ gameName: "Circle IQ", score, total: 8, shareText: SHARE_TEXT, canonicalUrl: PROD_URL });
}

describe("share-message — pure composition", () => {
  it("composes score, registry text, and canonical URL honestly", () => {
    expect(message()).toBe(
      `I scored 6/8 good reads on Circle IQ.\n${SHARE_TEXT}\n\nView online: ${PROD_URL}`
    );
  });

  it("represents weak results without inflating them", () => {
    expect(message(2)).toContain("I scored 2/8 good reads on Circle IQ.");
  });

  it("produces no localhost, tracking, or claim language", () => {
    const text = message();
    expect(text).not.toContain("localhost");
    expect(PROD_URL).not.toContain("?");
    expect(text).not.toMatch(/utm_|referral=|tracking=/);
    expect(text).not.toMatch(/pro\b|elite|perfect|predict|95%|IGL/i);
    expect(text).toContain(PROD_URL);
  });

  it("treats only share-sheet cancellation as abort", () => {
    expect(isShareAbort(new DOMException("cancelled", "AbortError"))).toBe(true);
    expect(isShareAbort(new DOMException("denied", "NotAllowedError"))).toBe(false);
    expect(isShareAbort(new Error("nope"))).toBe(false);
    expect(isShareAbort(null)).toBe(false);
  });
});

describe("share-message — configurable result noun (F1)", () => {
  it("defaults to good reads for Circle IQ compatibility", () => {
    expect(
      buildLabShareMessage({ gameName: "Circle IQ", score: 6, total: 8, shareText: SHARE_TEXT, canonicalUrl: PROD_URL })
    ).toBe(`I scored 6/8 good reads on Circle IQ.\n${SHARE_TEXT}\n\nView online: ${PROD_URL}`);
  });

  it("lets Rotation Replay supply its own lined-up reads noun", () => {
    const replayUrl = "https://micronestmicrotoolsesports.vercel.app/bgmi-lab/rotation-replay";
    const text = buildLabShareMessage({
      gameName: "Rotation Replay",
      score: 4,
      total: 5,
      resultNoun: "lined-up reads",
      shareText: "I compared my rotation calls against real BMSD 2026 Finals matches.",
      canonicalUrl: replayUrl,
    });
    expect(text).toContain("I scored 4/5 lined-up reads on Rotation Replay.");
    expect(text).not.toContain("good reads");
  });

  it("keeps the canonical URL unchanged with a custom noun and no tracking", () => {
    const text = buildLabShareMessage({
      gameName: "Rotation Replay",
      score: 4,
      total: 5,
      resultNoun: "lined-up reads",
      shareText: SHARE_TEXT,
      canonicalUrl: PROD_URL,
    });
    expect(text).toContain(`View online: ${PROD_URL}`);
    // Canonical URL is appended verbatim — no query string, no tracking.
    expect(text.split("View online: ")[1]).toBe(PROD_URL);
    expect(text).not.toMatch(/utm_|referral=|tracking=/);
  });
});

describe("ShareRow — completion share controls", () => {
  const html = renderToString(
    <ShareRow gameName="Circle IQ" score={6} total={8} shareText={SHARE_TEXT} canonicalUrl={PROD_URL} />
  );

  it("renders result, copy control, and an encoded WhatsApp deep link", () => {
    expect(html).toContain("SHARE YOUR RESULT");
    expect(html).toContain("Copy link");
    expect(html).toContain('aria-label="Copy Circle IQ link"');
    expect(html).toContain('aria-label="Share Circle IQ result on WhatsApp"');
    expect(html).toContain("https://wa.me/?text=");
    expect(html).toContain(encodeURIComponent(PROD_URL));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("omits native Share until capability is confirmed client-side", () => {
    expect(html).not.toContain(" Share</button>");
    expect(html).toContain('aria-label="Share your Circle IQ result"');
  });

  it("meets touch-target, labelling, and privacy contracts", () => {
    expect(html).toMatch(/min-h-\[44px\]/);
    expect(html).not.toContain("localhost");
    expect(html).not.toMatch(/utm_/);
    expect(html).toContain("Your score stays on this device");
  });

  it("stays client-side with no scoring-logic or server imports", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const rowSrc = strip(readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/share-row.tsx"), "utf8"));
    const msgSrc = strip(readFileSync(join(process.cwd(), "src/features/bgmi-lab/share-message.ts"), "utf8"));
    for (const src of [rowSrc, msgSrc]) {
      for (const banned of [
        "fetch(",
        "localStorage",
        "sessionStorage",
        "analytics",
        "/api/",
        "supabase",
        "billing",
        "entitlement",
        "adsbygoogle",
        "ca-pub",
      ]) {
        expect(src).not.toContain(banned);
      }
    }
    expect(rowSrc).not.toContain("circle-iq-logic");
    expect(rowSrc).not.toContain("scorePick");
  });

  it("forwards a custom result noun into the WhatsApp message without game branching", () => {
    const replayHtml = renderToString(
      <ShareRow
        gameName="Rotation Replay"
        score={4}
        total={5}
        resultNoun="lined-up reads"
        shareText={SHARE_TEXT}
        canonicalUrl="https://micronestmicrotoolsesports.vercel.app/bgmi-lab/rotation-replay"
      />
    );
    expect(replayHtml).toContain(encodeURIComponent("I scored 4/5 lined-up reads on Rotation Replay."));
    expect(replayHtml).not.toContain("good reads");
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const rowSrc = strip(readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/share-row.tsx"), "utf8"));
    expect(rowSrc).not.toMatch(/rotation-replay|circle-iq/);
  });
});
