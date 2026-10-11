import { describe, expect, it } from "vitest";
import {
  buildGamePresetSetupHref,
  getGameVetoPresetById,
  resolveGamePresetSetupNavigation,
} from "./game-presets";

describe("game preset setup navigation", () => {
  it("builds the existing match-setup route with the created template id", () => {
    expect(buildGamePresetSetupHref("acme", "091722c2-cf0c-4873-be4a-a05243a00e1f")).toBe(
      "/dashboard/acme/draft-ban/new?template=091722c2-cf0c-4873-be4a-a05243a00e1f"
    );
  });

  it("successful creation navigates to match setup with the returned template id", () => {
    const preset = getGameVetoPresetById("cs2-major-bo1");
    expect(preset).toBeDefined();
    const href = resolveGamePresetSetupNavigation("acme", { templateId: "template-123" });
    expect(href).toBe("/dashboard/acme/draft-ban/new?template=template-123");
  });

  it("failed creation does not navigate", () => {
    expect(resolveGamePresetSetupNavigation("acme", { error: "Template limit reached" })).toBeNull();
    expect(resolveGamePresetSetupNavigation("acme", {})).toBeNull();
    expect(resolveGamePresetSetupNavigation("acme", { templateId: "" })).toBeNull();
  });

  it("existing error handling stays intact (error message preserved by caller)", () => {
    const result = { error: "A template with this name already exists" };
    expect(resolveGamePresetSetupNavigation("acme", result)).toBeNull();
    expect(result.error).toBe("A template with this name already exists");
  });
});
