// G1-5 avatar contract unit tests (mocked, no network).
// Lane: pure unit. Storage RLS + RPC semantics are proven live; these tests
// prove canonicalization (D-G1-06 Option A), MIME/size/path validation,
// ownership derivation and fail-closed URL resolution.
//
// Authoritative: 05 section 1, 06 sections 2-5, 08 T1/T6, D-G1-06 Option A.

import { describe, expect, it } from "vitest";
import {
  AVATAR_ALLOWED_MIMES,
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  canonicalAvatarPathForMime,
  isAvatarMime,
  isValidAvatarPath,
} from "../schemas/avatar";

const UID = "11111111-1111-4111-8111-111111111111";

describe("avatar storage constants (06)", () => {
  it("uses the existing public bucket with the frozen 512 KB cap", () => {
    expect(AVATAR_BUCKET).toBe("public-avatars");
    expect(AVATAR_MAX_BYTES).toBe(524288);
    expect([...AVATAR_ALLOWED_MIMES].sort()).toEqual(
      ["image/jpeg", "image/png", "image/webp"].sort(),
    );
  });

  it("never allowlists SVG or other active content for avatars", () => {
    expect(isAvatarMime("image/svg+xml")).toBe(false);
    expect(isAvatarMime("image/gif")).toBe(false);
    expect(isAvatarMime("application/pdf")).toBe(false);
    expect(isAvatarMime("application/octet-stream")).toBe(false);
    expect(isAvatarMime("")).toBe(false);
    expect(isAvatarMime("image/png; charset=utf-8")).toBe(false);
  });
});

describe("D-G1-06 Option A — jpeg canonicalizes to jpg", () => {
  it("maps image/jpeg to avatar.jpg (single canonical path)", () => {
    expect(canonicalAvatarPathForMime(UID, "image/jpeg")).toBe(
      `${UID}/avatar.jpg`,
    );
  });

  it("keeps png and webp extensions", () => {
    expect(canonicalAvatarPathForMime(UID, "image/png")).toBe(
      `${UID}/avatar.png`,
    );
    expect(canonicalAvatarPathForMime(UID, "image/webp")).toBe(
      `${UID}/avatar.webp`,
    );
  });

  it("returns null for non-avatar MIME types (never a path)", () => {
    for (const mime of [
      "image/svg+xml",
      "image/gif",
      "application/pdf",
      "text/plain",
      "",
    ]) {
      expect(canonicalAvatarPathForMime(UID, mime)).toBeNull();
    }
  });
});

describe("isValidAvatarPath — fail-closed allowlist (08 T1/T6)", () => {
  it("accepts uid-scoped raster paths (incl. legacy jpeg on read)", () => {
    for (const ext of ["png", "jpg", "jpeg", "webp"]) {
      expect(isValidAvatarPath(`${UID}/avatar.${ext}`)).toBe(true);
    }
  });

  it("rejects absolute URLs so external input can never pass through", () => {
    for (const bad of [
      "https://evil.example/avatar.png",
      "http://evil.example/x.jpg",
      "//evil.example/avatar.png",
      "data:image/png;base64,AAAA",
      `${UID}/avatar.png?token=signed`,
      `${UID}/avatar.png#frag`,
    ]) {
      expect(isValidAvatarPath(bad)).toBe(false);
    }
  });

  it("rejects traversal, wrong shapes and non-raster extensions", () => {
    for (const bad of [
      `${UID}/avatar.svg`,
      `${UID}/avatar.gif`,
      `${UID}/other.png`,
      `other-user/avatar.png`,
      `../../${UID}/avatar.png`,
      `${UID}/avatar.PNG`,
      `${UID}/AVATAR.png`,
      "not-a-path",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isValidAvatarPath(bad)).toBe(false);
    }
  });
});
