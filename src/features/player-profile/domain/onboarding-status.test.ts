import { describe, expect, it } from "vitest";
import { resolveOnboardingStatus } from "./onboarding-status";
import {
  canAttemptTeamCreate,
  canBrowsePublicContent,
  canClaimVerifiedIdentity,
  canCompleteOwnProfile,
  canOptIntoDiscoverability,
} from "./access-policy";

describe("resolveOnboardingStatus (P14-D12)", () => {
  it("maps missing profile to not_started", () => {
    const snap = resolveOnboardingStatus(false, null);
    expect(snap.status).toBe("not_started");
    expect(snap.isVerified).toBe(false);
    expect(snap.completeness).toBeNull();
  });

  it("maps incomplete completeness to incomplete", () => {
    const snap = resolveOnboardingStatus(true, {
      complete: false,
      missing: ["avatar_or_bio", "game_profile"],
    });
    expect(snap.status).toBe("incomplete");
    expect(snap.isVerified).toBe(false);
  });

  it("maps complete completeness without verification claim", () => {
    const snap = resolveOnboardingStatus(true, { complete: true, missing: [] });
    expect(snap.status).toBe("complete");
    expect(snap.isVerified).toBe(false);
  });
});

describe("access-policy (P14-D12)", () => {
  it("allows public browse for every status", () => {
    expect(canBrowsePublicContent("anonymous").allowed).toBe(true);
    expect(canBrowsePublicContent("not_started").allowed).toBe(true);
  });

  it("blocks discoverability and team-create soft gates for not_started / incomplete", () => {
    expect(canOptIntoDiscoverability("not_started").allowed).toBe(false);
    expect(canOptIntoDiscoverability("incomplete").allowed).toBe(false);
    expect(canOptIntoDiscoverability("complete").allowed).toBe(true);
    expect(canOptIntoDiscoverability("complete", false).allowed).toBe(false);
    expect(canAttemptTeamCreate("not_started").allowed).toBe(false);
    expect(canAttemptTeamCreate("incomplete").allowed).toBe(false);
    expect(canAttemptTeamCreate("complete").allowed).toBe(true);
  });

  it("never allows a self-reported verified claim", () => {
    expect(canClaimVerifiedIdentity("complete").allowed).toBe(false);
    expect(canCompleteOwnProfile("incomplete").allowed).toBe(true);
  });
});
