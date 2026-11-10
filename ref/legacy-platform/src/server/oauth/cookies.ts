import type { Provider } from "@/server/credentials/repository";

export const OAUTH_STATE_COOKIE_PREFIX = "oauth_state_";
export const OAUTH_VERIFIER_COOKIE_PREFIX = "oauth_verifier_";
export const OAUTH_COOKIE_TTL_MS = 10 * 60 * 1000;

export function stateCookieName(provider: Provider): string {
  return `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
}

export function verifierCookieName(provider: Provider): string {
  return `${OAUTH_VERIFIER_COOKIE_PREFIX}${provider}`;
}

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

export function getStateCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(OAUTH_COOKIE_TTL_MS / 1000),
  };
}

export function getVerifierCookieOptions(): CookieOptions {
  return getStateCookieOptions();
}

// Safe redirect is already in @/lib/validation/isSafeRedirect — reuse.
// This file only documents that OAuth state must NOT contain arbitrary redirect destinations.
