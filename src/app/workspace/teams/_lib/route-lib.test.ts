// P2 workspace route-lib tests (pure, no network, no Supabase client).
// Covers: team-id segment validation (fail safe, never throws), workspace
// href building, creation/settings form parsing, and protected-key
// rejection (owner/creator/org on create; slug/game/owner/org on update).

import { describe, expect, it } from "vitest";
import { buildWorkspaceHref, isInvalidTeamId, parseWorkspaceTeamId } from "./params";
import { parseCreateTeamForm, parseUpdateTeamSettingsForm } from "./forms";

const TEAM_ID = "33333333-3333-4333-8333-333333333333";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";

const CREATE_RECORD = {
  slug: "nova-esports",
  name: "Nova Esports",
  gameKey: "bgmi",
  regionCode: "india",
  currentLevel: "competitive",
  targetLevel: "semi-pro",
  description: "A competitive BGMI squad.",
  recruiting: "true",
  isPublic: "true",
};

const PATCH_RECORD = {
  name: "Nova Esports",
  regionCode: "india",
  currentLevel: "competitive",
  targetLevel: "semi-pro",
  recruiting: "true",
  isPublic: "true",
};

describe("parseWorkspaceTeamId", () => {
  it("accepts uuids and rejects hostile segments without throwing", () => {
    expect(parseWorkspaceTeamId(TEAM_ID)).toEqual({ id: TEAM_ID });
    for (const raw of ["", "not-a-uuid", "' OR '1'='1", "../teams", "x".repeat(200), undefined]) {
      const parsed = parseWorkspaceTeamId(raw);
      expect(isInvalidTeamId(parsed)).toBe(true);
    }
    expect(() => parseWorkspaceTeamId("'; DROP TABLE teams; --")).not.toThrow();
  });
});

describe("buildWorkspaceHref", () => {
  it("builds overview, settings and roster URLs", () => {
    expect(buildWorkspaceHref(TEAM_ID)).toBe(`/workspace/teams/${TEAM_ID}`);
    expect(buildWorkspaceHref(TEAM_ID, "settings")).toBe(`/workspace/teams/${TEAM_ID}/settings`);
    expect(buildWorkspaceHref(TEAM_ID, "roster")).toBe(`/workspace/teams/${TEAM_ID}/roster`);
  });
});

describe("parseCreateTeamForm", () => {
  it("parses a complete valid record", () => {
    const parsed = parseCreateTeamForm({ ...CREATE_RECORD });
    expect(parsed.ok).toBe(true);
  });

  it("fails invalid records with a safe message (never throws)", () => {
    expect(parseCreateTeamForm({ ...CREATE_RECORD, slug: "BAD!" }).ok).toBe(false);
    expect(parseCreateTeamForm({ ...CREATE_RECORD, name: "x" }).ok).toBe(false);
    expect(parseCreateTeamForm({}).ok).toBe(false);
    const parsed = parseCreateTeamForm({});
    expect(parsed.message).toBeTruthy();
    expect(() => parseCreateTeamForm({ slug: ["a", "b"] })).not.toThrow();
  });

  it("rejects forged ownership/org keys", () => {
    for (const extra of [
      { owner_user_id: OWNER_ID },
      { created_by: OWNER_ID },
      { organization_id: "org-1" },
    ]) {
      expect(parseCreateTeamForm({ ...CREATE_RECORD, ...extra }).ok).toBe(false);
    }
  });
});

describe("parseUpdateTeamSettingsForm", () => {
  it("parses a valid patch record", () => {
    expect(parseUpdateTeamSettingsForm(TEAM_ID, { ...PATCH_RECORD }).ok).toBe(true);
  });

  it("rejects protected keys smuggled in the patch", () => {
    for (const extra of [
      { slug: "other-slug" },
      { gameKey: "bgmi" },
      { owner_user_id: OWNER_ID },
      { organization_id: "org-1" },
    ]) {
      expect(parseUpdateTeamSettingsForm(TEAM_ID, { ...PATCH_RECORD, ...extra }).ok).toBe(false);
    }
  });

  it("fails malformed ids and invalid fields safely", () => {
    expect(parseUpdateTeamSettingsForm("nope", { ...PATCH_RECORD }).ok).toBe(false);
    expect(parseUpdateTeamSettingsForm(TEAM_ID, {}).ok).toBe(false);
  });
});
