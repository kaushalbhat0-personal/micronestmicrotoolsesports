import { describe, expect, it, afterEach } from "vitest";
import { getOAuthAvailability, isYouTubePlatformKeyUsable } from "./availability";

afterEach(() => {
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;
  delete process.env.YOUTUBE_CLIENT_ID;
  delete process.env.YOUTUBE_CLIENT_SECRET;
  delete process.env.YOUTUBE_API_KEY;
  delete process.env.KICK_CLIENT_ID;
  delete process.env.KICK_CLIENT_SECRET;
});

describe("getOAuthAvailability — server-side capability only", () => {
  it("all configured → all available", () => {
    process.env.TWITCH_CLIENT_ID = "a";
    process.env.TWITCH_CLIENT_SECRET = "b";
    process.env.YOUTUBE_CLIENT_ID = "a";
    process.env.YOUTUBE_CLIENT_SECRET = "b";
    process.env.KICK_CLIENT_ID = "a";
    process.env.KICK_CLIENT_SECRET = "b";
    expect(getOAuthAvailability()).toEqual({ twitch: true, youtube: true, kick: true });
  });

  it("missing secret → not available (no fake button)", () => {
    process.env.TWITCH_CLIENT_ID = "a";
    expect(getOAuthAvailability().twitch).toBe(false);
  });

  it("missing id → not available", () => {
    process.env.KICK_CLIENT_SECRET = "b";
    expect(getOAuthAvailability().kick).toBe(false);
  });

  it("nothing configured → nothing available", () => {
    expect(getOAuthAvailability()).toEqual({ twitch: false, youtube: false, kick: false });
  });

  it("YouTube platform key fallback genuinely usable only when set", () => {
    expect(isYouTubePlatformKeyUsable()).toBe(false);
    process.env.YOUTUBE_API_KEY = "key123";
    expect(isYouTubePlatformKeyUsable()).toBe(true);
  });
});
