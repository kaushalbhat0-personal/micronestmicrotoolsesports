// P8 organization external-link validation (fail closed).
// Website and social URLs render only when they are valid https URLs without
// credentials. Anything else fails the row closed rather than rendering an
// attacker-controlled link. Mirrors the P3 registration URL rule.

export const MAX_ORG_URL_LENGTH = 2000;
export const MAX_ORG_SOCIAL_LINKS = 8;
export const MAX_ORG_SOCIAL_LABEL_LENGTH = 40;

export function isValidExternalUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ORG_URL_LENGTH) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return false;
  }
  if (parsed.hostname === "") {
    return false;
  }
  return true;
}

export const EXTERNAL_LINK_HANDOFF_NOTE =
  "External links leave MicroNest. We do not verify the content of external sites.";
