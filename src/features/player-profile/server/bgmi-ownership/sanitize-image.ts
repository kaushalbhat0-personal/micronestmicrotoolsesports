import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES,
  BgmiOwnershipValidationError,
  type BgmiOwnershipContentType,
} from "../../domain/bgmi-ownership";
import {
  BGMI_OWNERSHIP_MAX_DIMENSION,
  BGMI_OWNERSHIP_MAX_PIXELS,
  BGMI_OWNERSHIP_MIN_DIMENSION,
} from "../../schemas/bgmi-ownership";

export interface SanitizedEvidenceImage {
  bytes: Uint8Array;
  contentType: BgmiOwnershipContentType;
  width: number;
  height: number;
  sha256: string;
}

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.byteLength < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

function detectMagicMime(bytes: Uint8Array): BgmiOwnershipContentType | null {
  // Reject PDF / SVG / HTML polyglots early (never trust client MIME).
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    // %PDF
    return null;
  }
  if (
    startsWith(bytes, [0x3c, 0x73, 0x76, 0x67]) || // <svg
    startsWith(bytes, [0x3c, 0x3f, 0x78, 0x6d]) || // <?xm
    startsWith(bytes, [0x3c, 0x21]) // <!
  ) {
    return null;
  }
  // GIF (animated risk)
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) ||
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
  ) {
    return null;
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // RIFF....WEBP
  if (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Decode + re-encode evidence. Strips metadata. Rejects animated / bombs.
 * Never logs bytes or inferred PII.
 */
export async function sanitizeBgmiOwnershipImage(
  original: Uint8Array,
): Promise<SanitizedEvidenceImage> {
  if (
    !(original instanceof Uint8Array) ||
    original.byteLength < 32 ||
    original.byteLength > BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES
  ) {
    throw new BgmiOwnershipValidationError(
      "Evidence file must be a JPEG, PNG or WebP image up to 5 MB.",
    );
  }

  const magic = detectMagicMime(original);
  if (!magic) {
    throw new BgmiOwnershipValidationError(
      "Evidence file must be a JPEG, PNG or WebP image up to 5 MB.",
    );
  }

  let pipeline: ReturnType<typeof sharp>;
  try {
    pipeline = sharp(Buffer.from(original), {
      animated: false,
      limitInputPixels: BGMI_OWNERSHIP_MAX_PIXELS,
      failOn: "error",
    });
  } catch {
    throw new BgmiOwnershipValidationError("Evidence image could not be read.");
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await pipeline.metadata();
  } catch {
    throw new BgmiOwnershipValidationError("Evidence image could not be read.");
  }

  if (metadata.pages != null && metadata.pages > 1) {
    throw new BgmiOwnershipValidationError(
      "Animated images are not allowed for verification evidence.",
    );
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < BGMI_OWNERSHIP_MIN_DIMENSION ||
    height < BGMI_OWNERSHIP_MIN_DIMENSION ||
    width > BGMI_OWNERSHIP_MAX_DIMENSION ||
    height > BGMI_OWNERSHIP_MAX_DIMENSION ||
    width * height > BGMI_OWNERSHIP_MAX_PIXELS
  ) {
    throw new BgmiOwnershipValidationError(
      "Evidence image dimensions are not supported.",
    );
  }

  // Re-encode to strip EXIF/XMP and normalize. Preserve family when possible.
  let outMime: BgmiOwnershipContentType;
  let outBuffer: Buffer;
  try {
    if (magic === "image/png") {
      outMime = "image/png";
      outBuffer = await sharp(Buffer.from(original), {
        animated: false,
        limitInputPixels: BGMI_OWNERSHIP_MAX_PIXELS,
      })
        .rotate()
        .png({ compressionLevel: 9, force: true })
        .toBuffer();
    } else if (magic === "image/webp") {
      outMime = "image/webp";
      outBuffer = await sharp(Buffer.from(original), {
        animated: false,
        limitInputPixels: BGMI_OWNERSHIP_MAX_PIXELS,
      })
        .rotate()
        .webp({ quality: 90, effort: 4 })
        .toBuffer();
    } else {
      outMime = "image/jpeg";
      outBuffer = await sharp(Buffer.from(original), {
        animated: false,
        limitInputPixels: BGMI_OWNERSHIP_MAX_PIXELS,
      })
        .rotate()
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    }
  } catch {
    throw new BgmiOwnershipValidationError("Evidence image could not be sanitized.");
  }

  if (outBuffer.byteLength < 1 || outBuffer.byteLength > BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES) {
    throw new BgmiOwnershipValidationError(
      "Evidence file must be a JPEG, PNG or WebP image up to 5 MB.",
    );
  }

  let outMeta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    outMeta = await sharp(outBuffer).metadata();
  } catch {
    throw new BgmiOwnershipValidationError("Evidence image could not be sanitized.");
  }

  const outWidth = outMeta.width ?? 0;
  const outHeight = outMeta.height ?? 0;
  if (
    outWidth < BGMI_OWNERSHIP_MIN_DIMENSION ||
    outHeight < BGMI_OWNERSHIP_MIN_DIMENSION
  ) {
    throw new BgmiOwnershipValidationError(
      "Evidence image dimensions are not supported.",
    );
  }

  const sha256 = createHash("sha256").update(outBuffer).digest("hex");

  return {
    bytes: new Uint8Array(outBuffer),
    contentType: outMime,
    width: outWidth,
    height: outHeight,
    sha256,
  };
}
