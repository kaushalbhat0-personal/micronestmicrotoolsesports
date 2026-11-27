import { describe, expect, it } from "vitest";
import { decodeShareState } from "./share";
import { shareLinkErrorCopy } from "./share-error-copy";

/**
 * Share error copy (RCCF-TECHLEAK-FIX-01: F-04).
 * Every decoder failure maps to human copy; raw codes are never user-facing.
 */
describe("shareLinkErrorCopy", () => {
  it("maps the version code to the unsupported-version sentence", () => {
    expect(shareLinkErrorCopy("version")).toContain("unsupported version");
  });

  it("maps the too-long code to the too-large sentence", () => {
    expect(shareLinkErrorCopy("too long")).toContain("too large");
  });

  it("maps every other known decoder code to the malformed sentence", () => {
    const codes = [
      "empty",
      "too long-x",
      "base64",
      "json",
      "shape",
      "pool",
      "currency",
      "method",
      "equalCount",
      "placements",
      "placement shape",
      "placement values",
      "ctx shape",
      "ctx tournamentName",
      "ctx date",
      "ctx sponsorName",
      "validation: pool must be positive",
      "anything-else",
    ];
    for (const code of codes) {
      expect(shareLinkErrorCopy(code)).toBe("This share link is malformed or has been tampered with.");
    }
  });

  it("covers every code the live decoder can actually return", () => {
    const probeInputs = ["", "!!!not-base64!!!", "aGk=", "e30=", "bnVsbA=="];
    for (const input of probeInputs) {
      const decoded = decodeShareState(input);
      if (!decoded.ok) {
        const copy = shareLinkErrorCopy(decoded.error);
        expect([
          "This share link uses an unsupported version. Please generate a new link.",
          "This share link is too large.",
          "This share link is malformed or has been tampered with.",
        ]).toContain(copy);
      }
    }
  });
});
