// P9 organizer public links — https-only external identity.
// Website + social links are self-declared organizer claims, never proof of
// authority. Bad URLs fail the row closed (never render attacker-controlled
// links). Max 8 social links, labels ≤ 40 chars.

export const MAX_SOCIAL_LINKS = 8;
export const MAX_SOCIAL_LABEL_LENGTH = 40;

export interface OrganizerSocialLink {
  readonly label: string;
  readonly url: string;
}

export function isValidOrganizerUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) {
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

export function isOrganizerSocialLink(value: unknown): value is OrganizerSocialLink {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["label"] === "string" &&
    (record["label"] as string).trim().length > 0 &&
    (record["label"] as string).trim().length <= MAX_SOCIAL_LABEL_LENGTH &&
    isValidOrganizerUrl(record["url"])
  );
}

export const ORGANIZER_LINKS_NOTE =
  "Links are self-declared by the organizer and do not prove that MicroNest endorses this organizer.";
