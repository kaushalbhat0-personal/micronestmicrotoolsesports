import {
  BGMI_OWNERSHIP_PATH_PREFIX,
  type BgmiOwnershipContentType,
} from "../../domain/bgmi-ownership";

const EXT_BY_MIME: Record<BgmiOwnershipContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Server-built object path. Caller-supplied paths are rejected elsewhere.
 * Authorization is folder[1]=auth.uid() + case metadata — not the UUID alone.
 */
export function buildBgmiOwnershipObjectPath(input: {
  ownerUserId: string;
  caseId: string;
  evidenceId: string;
  contentType: BgmiOwnershipContentType;
}): string {
  const ext = EXT_BY_MIME[input.contentType];
  return `${input.ownerUserId}/${BGMI_OWNERSHIP_PATH_PREFIX}/${input.caseId}/${input.evidenceId}.${ext}`;
}

export function extensionForContentType(
  contentType: BgmiOwnershipContentType,
): string {
  return EXT_BY_MIME[contentType];
}
