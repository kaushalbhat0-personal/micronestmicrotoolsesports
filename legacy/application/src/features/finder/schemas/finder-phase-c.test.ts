import { describe, expect, it } from "vitest";
import {
  applicationCreateSchema,
  memberRoleUpdateSchema,
  recruitmentPostCreateSchema,
  teamCreateSchema,
  teamUpdateSchema,
} from "./finder";

const teamBase = {
  slug: "night-hawks",
  name: "Night Hawks",
  game: "bgmi" as const,
  region: "IN-North",
  current_level: "community" as const,
  target_level: "competitive" as const,
};

describe("finder Phase C schemas — team", () => {
  it("accepts a minimal valid team and applies safe defaults", () => {
    const parsed = teamCreateSchema.parse(teamBase);
    expect(parsed.recruiting).toBe(true);
    expect(parsed.contact_mode).toBe("application_only");
    expect(parsed.is_public).toBe(true);
  });

  it("rejects bad slugs and non-https external links", () => {
    expect(() => teamCreateSchema.parse({ ...teamBase, slug: "Bad Slug!" })).toThrow();
    expect(() =>
      teamCreateSchema.parse({ ...teamBase, external_link: "http://example.com/x" }),
    ).toThrow();
    expect(() =>
      teamCreateSchema.parse({ ...teamBase, external_link: "https://example.com/x" }),
    ).not.toThrow();
  });

  it("team updates never accept ownership fields", () => {
    const parsed = teamUpdateSchema.parse({
      name: "Night Hawks",
      region: "IN-North",
      current_level: "community",
      target_level: "competitive",
      recruiting: true,
      contact_mode: "application_only",
      is_public: true,
    });
    expect(parsed).not.toHaveProperty("captain_user_id");
    expect(parsed).not.toHaveProperty("created_by");
    expect(parsed).not.toHaveProperty("slug");
  });
});

describe("finder Phase C schemas — recruitment + application", () => {
  const postBase = {
    team_id: "00000000-0000-4000-8000-000000000001",
    game: "bgmi" as const,
    role_needed: "Scout" as const,
    slots: 2,
    current_level_min: "community" as const,
    target_level: "competitive" as const,
    region: "IN-North",
    availability_required: [],
    tryout_required: true,
    status: "open" as const,
  };

  it("accepts a valid post and bounds slots 1–10", () => {
    expect(recruitmentPostCreateSchema.parse(postBase).slots).toBe(2);
    expect(() =>
      recruitmentPostCreateSchema.parse({ ...postBase, slots: 0 }),
    ).toThrow();
    expect(() =>
      recruitmentPostCreateSchema.parse({ ...postBase, slots: 11 }),
    ).toThrow();
  });

  it("rejects unknown roles and non-uuid team authority", () => {
    expect(() =>
      recruitmentPostCreateSchema.parse({ ...postBase, role_needed: "AWPer" }),
    ).toThrow();
    expect(() =>
      recruitmentPostCreateSchema.parse({ ...postBase, team_id: "team-1" }),
    ).toThrow();
  });

  it("caps application notes and member roles", () => {
    expect(() =>
      applicationCreateSchema.parse({
        post_id: "00000000-0000-4000-8000-000000000001",
        note: "x".repeat(201),
      }),
    ).toThrow();
    expect(
      memberRoleUpdateSchema.parse({ role: "co-captain", game_role: "IGL" }).role,
    ).toBe("co-captain");
    expect(() => memberRoleUpdateSchema.parse({ role: "fan" })).toThrow();
  });
});
