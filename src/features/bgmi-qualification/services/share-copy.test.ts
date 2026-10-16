import { describe, expect, it } from "vitest";
import { buildShareUrl, decodeShareState, encodeShareState } from "./share";
import { gapMessage, outOfReachMessage, rateMessage, scenarioMessage, verdictLabel } from "./copy";
import { buildQualificationWhatsAppMessage } from "./whatsapp";
import type { QualificationShareState } from "../types";

const BANNED = [/safe/i, /guaranteed/i, /certain/i, /will qualify/i, /locked/i];

function baseState(): QualificationShareState {
  return {
    v: 1,
    current: 42,
    target: 58,
    matches: 4,
    preset: "krafton-2026",
    scenarios: [{ placement: 1, finishes: 8 }],
    averageRate: null,
  };
}

describe("share encode/decode", () => {
  it("round-trips deterministically", () => {
    const enc = encodeShareState(baseState());
    const dec = decodeShareState(enc);
    expect(dec.ok).toBe(true);
    expect(dec.state).toEqual(baseState());
    expect(encodeShareState(baseState())).toBe(enc);
  });

  it("buildShareUrl embeds ?s=", () => {
    expect(buildShareUrl("https://example.com/share/bgmi-qualification", baseState())).toContain(
      "/share/bgmi-qualification?s="
    );
  });

  it("rejects malformed input without throwing", () => {
    expect(decodeShareState("").ok).toBe(false);
    expect(decodeShareState("!!!notbase64!!!").ok).toBe(false);
    expect(decodeShareState("x".repeat(4001)).ok).toBe(false);
    const tampered = encodeShareState(baseState()).slice(0, -4) + "AAAA";
    // either decodes to different values (still validated) or fails — never throws
    expect(() => decodeShareState(tampered)).not.toThrow();
  });

  it("rejects out-of-range values and unknown versions", () => {
    const bad = { ...baseState(), current: -5 };
    expect(decodeShareState(encodeShareState(bad as never)).ok).toBe(false);
    const v2 = { ...baseState(), v: 2 };
    const raw = Buffer.from(JSON.stringify(v2), "utf-8").toString("base64url");
    expect(decodeShareState(raw).error).toBe("version");
    const four = Buffer.from(
      JSON.stringify({ ...baseState(), scenarios: [1, 2, 3, 4].map(() => ({ placement: 1, finishes: 1 })) }),
      "utf-8"
    ).toString("base64url");
    expect(decodeShareState(four).error).toBe("scenarios");
  });

  it("caps scenarios at 3 on encode", () => {
    const s = {
      ...baseState(),
      scenarios: [1, 2, 3, 4, 5].map((n) => ({ placement: n, finishes: n })),
    };
    const dec = decodeShareState(encodeShareState(s));
    expect(dec.ok).toBe(true);
    expect(dec.state?.scenarios).toHaveLength(3);
  });
});

describe("trust copy", () => {
  it("uses approved verdict labels", () => {
    expect(verdictLabel("above")).toBe("Above target");
    expect(verdictLabel("exact")).toBe("Needs tiebreak");
    expect(verdictLabel("below")).toBe("Below target");
  });

  it("gap message handles met-target and no-matches-left", () => {
    expect(gapMessage(16, 4)).toBe("You need 16 more points from 4 matches.");
    expect(gapMessage(0, 4)).toContain("Target met on points");
    expect(gapMessage(5, 0)).toContain("no matches left");
  });

  it("rate message handles null and met-target", () => {
    expect(rateMessage(null)).toBeNull();
    expect(rateMessage(4)).toBe("Required average: 4 pts per match.");
    expect(rateMessage(2.5)).toBe("Required average: 2.5 pts per match.");
  });

  it("scenario message covers above/exact/below", () => {
    expect(scenarioMessage(1, 8, 18, 60, 58, "above")).toContain("above your 58-pt target");
    expect(scenarioMessage(1, 8, 18, 58, 58, "exact")).toContain("tiebreak");
    expect(scenarioMessage(5, 5, 8, 50, 58, "below")).toContain("8 points short");
  });

  it("out-of-reach message states its assumption", () => {
    expect(outOfReachMessage()).toContain("under the current assumptions");
  });

  it("never uses banned trust words", () => {
    const samples = [
      verdictLabel("above"),
      verdictLabel("exact"),
      verdictLabel("below"),
      gapMessage(16, 4),
      gapMessage(0, 4),
      gapMessage(5, 0),
      rateMessage(4) ?? "",
      scenarioMessage(1, 8, 18, 60, 58, "above"),
      scenarioMessage(1, 8, 18, 58, 58, "exact"),
      scenarioMessage(5, 5, 8, 50, 58, "below"),
      outOfReachMessage(),
    ];
    for (const text of samples) {
      for (const pattern of BANNED) expect(text).not.toMatch(pattern);
    }
  });
});

describe("whatsapp share text", () => {
  it("contains the important scenario values plus share URL", () => {
    const msg = buildQualificationWhatsAppMessage(
      {
        current: 42,
        target: 58,
        matches: 4,
        pointsNeeded: 16,
        scenario: { placement: 1, finishes: 8 },
        scenarioTotal: 18,
        projected: 60,
        verdictLine: "Above target.",
      },
      "https://example.com/share/bgmi-qualification?s=abc"
    );
    expect(msg).toContain("Current: 42 pts");
    expect(msg).toContain("Target: 58 pts");
    expect(msg).toContain("Matches left: 4");
    expect(msg).toContain("Need: +16 pts");
    expect(msg).toContain("1st + 8 finishes");
    expect(msg).toContain("+18 pts");
    expect(msg).toContain("60 projected");
    expect(msg.endsWith("View online: https://example.com/share/bgmi-qualification?s=abc")).toBe(true);
    for (const pattern of BANNED) expect(msg).not.toMatch(pattern);
  });
});
