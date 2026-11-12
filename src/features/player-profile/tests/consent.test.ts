import { describe, expect, it } from "vitest";
import { setDiscoverabilityInputSchema } from "../schemas/discoverability";
import { createPlayerProfileInputSchema } from "../schemas/create-profile";

describe("setDiscoverabilityInputSchema (04 §2, 07)", () => {
  it("requires an explicit boolean", () => {
    expect(setDiscoverabilityInputSchema.parse({ is_discoverable: true })).toEqual({
      is_discoverable: true,
    });
    expect(setDiscoverabilityInputSchema.parse({ is_discoverable: false })).toEqual({
      is_discoverable: false,
    });
    expect(
      setDiscoverabilityInputSchema.safeParse({}).success,
    ).toBe(false);
    expect(
      setDiscoverabilityInputSchema.safeParse({ is_discoverable: "true" }).success,
    ).toBe(false);
  });

  it("rejects mass-assigned keys", () => {
    expect(
      setDiscoverabilityInputSchema.safeParse({
        is_discoverable: true,
        user_id: "someone-else",
      }).success,
    ).toBe(false);
  });
});

describe("createPlayerProfileInputSchema (07, 08 T4)", () => {
  const valid = {
    handle: "nova_01",
    display_name: "Nova",
  };

  it("accepts a minimal profile; optionals stay absent", () => {
    const parsed = createPlayerProfileInputSchema.parse(valid);
    expect(parsed.handle).toBe("nova_01");
    expect(parsed.display_name).toBe("Nova");
    expect(parsed.bio).toBeUndefined();
    expect(parsed.country_code).toBeUndefined();
  });

  it("accepts valid optionals and normalizes them", () => {
    const parsed = createPlayerProfileInputSchema.parse({
      ...valid,
      bio: "BGMI scout.",
      country_code: "in",
    });
    expect(parsed.bio).toBe("BGMI scout.");
    expect(parsed.country_code).toBe("IN");
  });

  it("never accepts publish or identity flags at creation", () => {
    for (const extra of [
      { is_discoverable: true },
      { user_id: "someone-else" },
      { status: "active" },
    ]) {
      expect(
        createPlayerProfileInputSchema.safeParse({ ...valid, ...extra }).success,
      ).toBe(false);
    }
  });

  it("rejects invalid handles, names and country codes", () => {
    expect(
      createPlayerProfileInputSchema.safeParse({ ...valid, handle: "ab" }).success,
    ).toBe(false);
    expect(
      createPlayerProfileInputSchema.safeParse({ ...valid, display_name: "" }).success,
    ).toBe(false);
    expect(
      createPlayerProfileInputSchema.safeParse({ ...valid, country_code: "ONLINE" })
        .success,
    ).toBe(false);
  });
});
