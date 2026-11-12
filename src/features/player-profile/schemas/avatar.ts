import { z } from "zod";

// Authoritative: 03 section 1 + 05 section 1 (avatar_path CHECK) + 06 storage
// design + D-G1-06 Option A (canonicalize jpeg→jpg, recorded in the G1-5
// report; no product approval required per 10, no migration: the DB CHECK
// already permits both jpg and jpeg).
//
// Plumbing vs canonical contract:
// - avatarPathSchema mirrors the DB CHECK exactly: {uuid}/avatar.{png,jpg,
//   jpeg,webp}. It accepts legacy `jpeg` rows on READ so existing data never
//   fails validation.
// - New WRITES are canonical: {png,jpg,webp} only. image/jpeg uploads always
//   store as `avatar.jpg` (D-G1-06 Option A: single path per user simplifies
//   replacement; at most one live file per user).
// - The path is uid-scoped (traversal impossible: no user subpaths).

export const AVATAR_BUCKET = "public-avatars" as const;

// Bucket cap (06 section 4 + storage foundation): 512 KB = 524288 bytes.
export const AVATAR_MAX_BYTES = 524288 as const;

// Bucket MIME allowlist for avatars (raster only, never SVG).
export const AVATAR_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AvatarMime = (typeof AVATAR_ALLOWED_MIMES)[number];

// D-G1-06 Option A: canonical extension per MIME (jpeg→jpg).
export const AVATAR_EXTENSION_BY_MIME: Record<AvatarMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const avatarPathSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f-]{36}\/avatar\.(png|jpe?g|webp)$/,
    "avatar_path must be {uid}/avatar.{png,jpg,jpeg,webp}",
  );

export const avatarPathInputSchema = avatarPathSchema.nullish();

export type AvatarPath = z.infer<typeof avatarPathSchema>;

// Canonical write paths only (no legacy `jpeg` on write).
export const canonicalAvatarPathSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f-]{36}\/avatar\.(png|jpg|webp)$/,
    "avatar_path must be {uid}/avatar.{png,jpg,webp}",
  );

export function isAvatarMime(value: string): value is AvatarMime {
  return (AVATAR_ALLOWED_MIMES as readonly string[]).includes(value);
}

// Canonical storage path for a new upload (D-G1-06 Option A).
// Returns null when the MIME is not in the avatar allowlist.
export function canonicalAvatarPathForMime(
  userId: string,
  mimeType: string,
): string | null {
  if (!isAvatarMime(mimeType)) {
    return null;
  }
  const ext = AVATAR_EXTENSION_BY_MIME[mimeType];
  return `${userId}/avatar.${ext}`;
}

// Strict relative-path allowlist for anything that will be resolved to a
// public URL (reader + server). Rejects absolute URLs, traversal, query
// strings and wrong-owner shapes. NULL is handled by callers (stays NULL).
export function isValidAvatarPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f-]{36}\/avatar\.(png|jpe?g|webp)$/.test(value)
  );
}
