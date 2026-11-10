import { describe, expect, it } from "vitest";
import { validateTeamLogoFile } from "./team-logo-service";

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(Math.max(size, 1))], name, { type });
}

describe("team logo validation", () => {
  it("accepts PNG, JPEG, and WebP", () => {
    expect(validateTeamLogoFile(file("a.png", "image/png", 10)).ext).toBe("png");
    expect(validateTeamLogoFile(file("a.jpg", "image/jpeg", 10)).ext).toBe("jpg");
    expect(validateTeamLogoFile(file("a.webp", "image/webp", 10)).ext).toBe("webp");
  });

  it("rejects SVG, empty, and oversized files", () => {
    expect(() => validateTeamLogoFile(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).toThrow(
      /PNG, JPEG/,
    );
    expect(() => validateTeamLogoFile(new File([], "empty.png", { type: "image/png" }))).toThrow(
      /empty/,
    );
    expect(() =>
      validateTeamLogoFile(file("big.png", "image/png", 600 * 1024)),
    ).toThrow(/512 KB/);
  });
});
