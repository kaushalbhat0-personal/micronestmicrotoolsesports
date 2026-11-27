// Shared auth input validation (P14-D10).
// Client forms validate instantly; server-side Supabase remains the final
// authority. Messages are generic on purpose (no account-enumeration oracle).

export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface FieldValidation {
  ok: boolean;
  message: string;
}

export function validateEmail(raw: unknown): FieldValidation {
  const email = typeof raw === "string" ? raw.trim() : "";
  if (email.length === 0) return { ok: false, message: "Enter your email address." };
  if (email.length > 254) return { ok: false, message: "Enter a valid email address." };
  if (!EMAIL_PATTERN.test(email)) return { ok: false, message: "Enter a valid email address." };
  return { ok: true, message: "" };
}

export function validatePassword(raw: unknown): FieldValidation {
  const password = typeof raw === "string" ? raw : "";
  if (password.length === 0) return { ok: false, message: "Enter a password." };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (password.length > 128) {
    return { ok: false, message: "Password is too long (max 128 characters)." };
  }
  return { ok: true, message: "" };
}

export function validateDisplayName(raw: unknown): FieldValidation {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length === 0) return { ok: false, message: "Enter your display name." };
  if (name.length < DISPLAY_NAME_MIN_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${DISPLAY_NAME_MIN_LENGTH} characters.`,
    };
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Keep your display name under ${DISPLAY_NAME_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, message: "" };
}

export const PASSWORD_REQUIREMENTS_COPY = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  "A mix of letters and numbers is recommended",
  "Avoid reusing passwords from other sites",
] as const;
