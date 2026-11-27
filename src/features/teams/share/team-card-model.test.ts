import { describe, expect, it } from "vitest";
import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";
import {
  assertTeamShareHasNoPrivateKeys,
  buildTeamShareSpec,
  toTeamShareInput,
} from "./team-card-model";

const team: PublicTeamDetail = {
  id: "should-not-appear-in-share-input",
  slug: "iron-wolves",
  name: "Iron Wolves",
  game_key: "bgmi",
  region_code: "india",
  current_level: "tier-2",
  target_level: "tier-1",
  recruiting: true,
  member_count: 4,
  description: "Scrim-focused squad",
};

describe("team share model", () => {
  it("omits uuid id from share input", () => {
    const input = toTeamShareInput(team, "https://example.test/teams/iron-wolves");
    expect(input).not.toBeNull();
    expect("id" in (input as object)).toBe(false);
    expect(assertTeamShareHasNoPrivateKeys({ ...input! })).toBe(true);
  });

  it("uses Open to Recruitment only when recruiting is true", () => {
    const recruiting = buildTeamShareSpec(
      toTeamShareInput(team, "https://example.test/teams/iron-wolves")!,
    );
    expect(recruiting.rows.some((r) => r.value === "Open to Recruitment")).toBe(true);

    const closed = buildTeamShareSpec(
      toTeamShareInput({ ...team, recruiting: false }, "https://example.test/teams/iron-wolves")!,
    );
    expect(closed.rows.some((r) => r.value === "Open to Recruitment")).toBe(false);
    expect(closed.eyebrow).toBe("Public Team");
  });

  it("never invents open roles or roster identities", () => {
    const spec = buildTeamShareSpec(
      toTeamShareInput(team, "https://example.test/teams/iron-wolves")!,
    );
    const blob = JSON.stringify(spec).toLowerCase();
    expect(blob).not.toContain("assaulter needed");
    expect(blob).not.toContain("owner_user_id");
    expect(spec.disclaimer.toLowerCase()).toContain("roster identities");
    expect(spec.destinationLabel).toContain("teams/iron-wolves");
  });

  it("rejects empty team URL", () => {
    expect(toTeamShareInput(team, "")).toBeNull();
  });
});
