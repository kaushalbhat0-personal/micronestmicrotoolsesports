import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEXT_PATH,
  SIGNUP_DEFAULT_NEXT_PATH,
  safeNextPath,
  safeSignupNextPath,
} from "./redirect";

describe("safeNextPath — allowlisted post-auth redirects (P14-D10/D12)", () => {
  it("accepts exact allowlisted destinations", () => {
    expect(safeNextPath("/workspace/teams")).toBe("/workspace/teams");
    expect(safeNextPath("/teams/new")).toBe("/teams/new");
    expect(safeNextPath("/settings/profile")).toBe("/settings/profile");
    expect(safeNextPath("/onboarding/profile")).toBe("/onboarding/profile");
  });

  it("accepts workspace sub-routes under the /workspace/ prefix", () => {
    expect(safeNextPath("/workspace/organizer/tournaments")).toBe(
      "/workspace/organizer/tournaments"
    );
  });

  it("falls back for missing, external, protocol-relative and absolute URLs", () => {
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("https://evil.example/phish")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("//evil.example/workspace/teams")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("/workspace/teams\\@evil")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("/settings/profile:8080")).toBe(DEFAULT_NEXT_PATH);
  });

  it("rejects non-allowlisted public paths (no open redirect)", () => {
    expect(safeNextPath("/players")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("/teams")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("/about")).toBe(DEFAULT_NEXT_PATH);
  });

  it("rejects the bare /workspace prefix without a sub-route", () => {
    expect(safeNextPath("/workspace")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("/workspace/")).toBe(DEFAULT_NEXT_PATH);
  });

  it("signup default lands on profile onboarding when next is absent", () => {
    expect(safeSignupNextPath(null)).toBe(SIGNUP_DEFAULT_NEXT_PATH);
    expect(safeSignupNextPath("")).toBe(SIGNUP_DEFAULT_NEXT_PATH);
    expect(safeSignupNextPath("/workspace/teams")).toBe("/workspace/teams");
    expect(safeSignupNextPath("https://evil.example")).toBe(DEFAULT_NEXT_PATH);
  });
});
