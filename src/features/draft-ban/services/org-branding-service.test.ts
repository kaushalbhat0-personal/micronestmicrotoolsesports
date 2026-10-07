import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removeOrgLogo, uploadOrgLogo, validateLogoFile } from "./org-branding-service";

function png(size = 100): File {
  return new File([new Uint8Array(size)], "logo.png", { type: "image/png" });
}

describe("org-branding-service validation", () => {
  it("accepts PNG/JPEG/WebP within limits", () => {
    expect(validateLogoFile(png()).ext).toBe("png");
    expect(validateLogoFile(new File([new Uint8Array(10)], "a.jpg", { type: "image/jpeg" })).ext).toBe("jpg");
  });

  it("rejects SVG, oversized, and empty files", () => {
    expect(() => validateLogoFile(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).toThrow(/PNG, JPEG/);
    expect(() => validateLogoFile(new File([new Uint8Array(600 * 1024)], "big.png", { type: "image/png" }))).toThrow(/512 KB/);
    expect(() => validateLogoFile(new File([], "empty.png", { type: "image/png" }))).toThrow(/empty/);
  });

  it("requires owner/admin role", async () => {
    const supabase = {} as SupabaseClient;
    await expect(uploadOrgLogo(supabase, { organizationId: "o1", role: "member", previousLogoUrl: null, file: png() })).rejects.toThrow(/owner/i);
    await expect(removeOrgLogo(supabase, { organizationId: "o1", role: "member" })).rejects.toThrow(/owner/i);
  });

  it("uploads to the org-scoped path and stores the public URL", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const remove = vi.fn(async () => ({}));
    const supabase = {
      storage: { from: vi.fn(() => ({ upload, remove, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) })) },
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
    } as unknown as SupabaseClient;
    const url = await uploadOrgLogo(supabase, { organizationId: "org-1", role: "admin", previousLogoUrl: null, file: png() });
    expect(url).toContain("org-1/logo.png");
    expect(upload).toHaveBeenCalledOnce();
  });
});
