// P3 tournaments domain — registration method + external URL validation.
// Only external registration exists in this phase: organizers register
// players on their own site/forms, and MicroNest hands off clearly. An
// in-platform registration method is reserved as a type and never
// validated, rendered, or accepted — inventing it would imply payment and
// operations flows that are out of scope.
//
// External URL rules (fail closed):
// - https only (no http, no protocol-relative, no javascript:/data:).
// - No embedded credentials (user:pass@).
// - Hostname required; length capped at 2000.
// - No query-string stripping or rewriting: the organizer URL is handed off
//   verbatim (plus rel="noopener" at render).

export const MAX_REGISTRATION_URL_LENGTH = 2000;
export const MAX_CONTACT_LENGTH = 500;

export const REGISTRATION_METHODS = ["external"] as const;

export type RegistrationMethod = (typeof REGISTRATION_METHODS)[number];

export function isRegistrationMethod(value: unknown): value is RegistrationMethod {
  return value === "external";
}

/** Reserved type only — never enabled, never validated, never rendered. */
export type ReservedInternalRegistration = "micronest";

export function isValidRegistrationUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_REGISTRATION_URL_LENGTH) {
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

export const EXTERNAL_HANDOFF_NOTE =
  "Registration happens on the organizer's site. You leave MicroNest to register — we never collect entry fees or payments.";
