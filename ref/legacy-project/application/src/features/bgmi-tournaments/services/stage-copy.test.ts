import { describe, expect, it } from "vitest";
import { stageMessaging } from "./stage-copy";

describe("stageMessaging — ongoing Smash Rule (Showdown-06)", () => {
  const ongoing = stageMessaging({
    status: "ongoing",
    smashRule: true,
    matchPointThreshold: 126,
    completedMatches: 12,
    totalMatches: 18,
  });

  it("never claims the stage ended or positions were decided", () => {
    expect(ongoing.smashCallout).not.toBeNull();
    expect(ongoing.smashCallout ?? "").not.toMatch(/ended/i);
    expect(ongoing.smashCallout ?? "").not.toMatch(/final positions were decided/i);
    expect(ongoing.smashCallout ?? "").not.toMatch(/champion is|already the champion/i);
  });

  it("states remaining matches and the threshold from data, not hard-coded prose", () => {
    const copy = ongoing.smashCallout ?? "";
    expect(copy).toContain("still ongoing");
    expect(copy).toContain("12 of 18 matches are complete");
    expect(copy).toContain("final 6 matches still to play");
    expect(copy).toContain("126-point threshold");
  });

  it("explains eligibility, the later-win requirement, and the points fallback", () => {
    const copy = ongoing.smashCallout ?? "";
    expect(copy).toContain("Match Point Eligible");
    expect(copy).toMatch(/must then win a Chicken Dinner in a later match/i);
    expect(copy).toContain("If no eligible team wins a later match by Match 18");
    expect(copy).toContain("the team with the most points wins");
  });

  it("labels the table as a non-final points race", () => {
    expect(ongoing.standingsHeading).toBe("Current points race");
    expect(ongoing.standingsNote).toContain("not final");
  });
});

describe("stageMessaging — completed Smash Rule (regression)", () => {
  it("preserves the existing completed wording byte-for-byte", () => {
    const completed = stageMessaging({
      status: "completed",
      smashRule: true,
      matchPointThreshold: 204,
      completedMatches: 18,
      totalMatches: 18,
    });
    expect(completed.smashCallout).toBe(
      "This stage ended with a Smash Rule (match-point) format — the match-point threshold was 204 points. " +
        "The table below shows the points race; final positions were decided by the match-point rule, not by points alone."
    );
    expect(completed.standingsHeading).toBe("Standings");
    expect(completed.standingsNote).toBeNull();
  });

  it("omits the threshold clause without breaking completed wording when unknown", () => {
    const completed = stageMessaging({
      status: "completed",
      smashRule: true,
      matchPointThreshold: null,
      completedMatches: 18,
      totalMatches: 18,
    });
    expect(completed.smashCallout).toBe(
      "This stage ended with a Smash Rule (match-point) format. " +
        "The table below shows the points race; final positions were decided by the match-point rule, not by points alone."
    );
  });
});

describe("stageMessaging — non-Smash stages (regression)", () => {
  it("emits no Smash copy for ordinary ongoing or completed stages", () => {
    for (const status of ["upcoming", "ongoing", "completed"]) {
      const plain = stageMessaging({
        status,
        smashRule: false,
        matchPointThreshold: null,
        completedMatches: 6,
        totalMatches: 18,
      });
      expect(plain.smashCallout).toBeNull();
      expect(plain.standingsHeading).toBe("Standings");
      expect(plain.standingsNote).toBeNull();
    }
  });
});
