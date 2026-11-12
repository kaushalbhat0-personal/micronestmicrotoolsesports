import { z } from "zod";
import { describe, expect, it } from "vitest";
import { avatarPathInputSchema, avatarPathSchema } from "../schemas/avatar";
import { updatePlayerProfileInputSchema } from "../schemas/update-profile";

const UID = "11111111-1111-4111-8111-111111111111";
const AVATAR = `${UID}/avatar.png`;

describe("avatarPathSchema (05 section 1 CHECK mirror)", () => {
  it("accepts uid-scoped raster paths", () => {
    expect(avatarPathSchema.parse(`${UID}/avatar.png`)).toBe(
      `${UID}/avatar.png`,
    );
    expect(avatarPathSchema.parse(`${UID}/avatar.jpg`)).toBe(
      `${UID}/avatar.jpg`,
    );
    expect(avatarPathSchema.parse(`${UID}/avatar.jpeg`)).toBe(
      `${UID}/avatar.jpeg`,
    );
    expect(avatarPathSchema.parse(`${UID}/avatar.webp`)).toBe(
      `${UID}/avatar.webp`,
    );
  });

  it("rejects traversal, wrong owners, and non-raster extensions", () => {
    for (const bad of [
      `${UID}/avatar.svg`,
      `${UID}/avatar.gif`,
      "other-user/avatar.png",
      `../../${UID}/avatar.png`,
      `${UID}/other.png`,
      `${UID}/avatar.png?x=1`,
      "not-a-path",
      "",
    ]) {
      expect(avatarPathSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("is nullish at the input boundary (clearing allowed)", () => {
    expect(avatarPathInputSchema.parse(undefined)).toBeUndefined();
    expect(avatarPathInputSchema.parse(null)).toBeNull();
    expect(avatarPathInputSchema.parse(AVATAR)).toBe(AVATAR);
  });
});

describe("updatePlayerProfileInputSchema (07, 08 T4)", () => {
  it("accepts a partial patch of allowlisted fields", () => {
    expect(
      updatePlayerProfileInputSchema.parse({ display_name: "Nova Prime" }),
    ).toEqual({ display_name: "Nova Prime" });
    expect(
      updatePlayerProfileInputSchema.parse({
        bio: "BGMI scout.",
        country_code: "in",
      }),
    ).toEqual({ bio: "BGMI scout.", country_code: "IN" });
    expect(updatePlayerProfileInputSchema.parse({ bio: null })).toEqual({
      bio: null,
    });
    expect(
      updatePlayerProfileInputSchema.parse({ country_code: null }),
    ).toEqual({ country_code: null });
    expect(
      updatePlayerProfileInputSchema.parse({ avatar_path: AVATAR }),
    ).toEqual({ avatar_path: AVATAR });
    expect(updatePlayerProfileInputSchema.parse({ avatar_path: null })).toEqual(
      { avatar_path: null },
    );
  });

  it("rejects an empty patch (no-op updates are not written)", () => {
    expect(updatePlayerProfileInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects handle changes in the generic patch (D-G1-05 open, G1-7 owns it)", () => {
    expect(
      updatePlayerProfileInputSchema.safeParse({ handle: "new_handle" })
        .success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({
        display_name: "Nova",
        handle: "new_handle",
      }).success,
    ).toBe(false);
  });

  it("rejects discoverability smuggling (dedicated consent action owns it)", () => {
    expect(
      updatePlayerProfileInputSchema.safeParse({ is_discoverable: true })
        .success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({
        display_name: "Nova",
        is_discoverable: true,
      }).success,
    ).toBe(false);
  });

  it("rejects ownership and administrative fields", () => {
    for (const extra of [
      { user_id: "someone-else" },
      { status: "active" },
      { suspension_reason: "x" },
      { created_at: new Date().toISOString() },
    ]) {
      expect(
        updatePlayerProfileInputSchema.safeParse({
          display_name: "Nova",
          ...extra,
        }).success,
      ).toBe(false);
    }
  });

  it("rejects invalid values (incl. ONLINE as country)", () => {
    expect(
      updatePlayerProfileInputSchema.safeParse({ display_name: "" }).success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({
        display_name: "x".repeat(41),
      }).success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({ bio: "x".repeat(281) })
        .success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({ country_code: "ONLINE" })
        .success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({ country_code: "XX" }).success,
    ).toBe(true);
    expect(
      updatePlayerProfileInputSchema.safeParse({ country_code: "USA" }).success,
    ).toBe(false);
    expect(
      updatePlayerProfileInputSchema.safeParse({ avatar_path: "evil.svg" })
        .success,
    ).toBe(false);
  });

  it("exposes the exact allowlist (no silent drift)", () => {
    const shape = updatePlayerProfileInputSchema;
    expect(shape instanceof z.ZodType).toBe(true);
    const parsed = updatePlayerProfileInputSchema.parse({
      display_name: "Nova",
      bio: null,
      country_code: "IN",
      avatar_path: null,
    });
    expect(Object.keys(parsed).sort()).toEqual(
      ["avatar_path", "bio", "country_code", "display_name"].sort(),
    );
  });
});
