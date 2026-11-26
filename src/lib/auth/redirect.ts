// Safe post-auth redirect allowlist (P14-D10).
// Single source shared by /login, /signup and /auth/callback.
// Only same-origin relative paths in the explicit allow set are honored;
// everything else falls back to the team workspace. This prevents open
// redirects from `?next=` while keeping protected-route return flows.

import type { Route } from "next";

/** Fallback for login / callback when `next` is missing or unsafe. */
export const DEFAULT_NEXT_PATH = "/workspace/teams" as Route;

/** Default post-signup destination (P14-D12 frictionless onboarding). */
export const SIGNUP_DEFAULT_NEXT_PATH = "/onboarding/profile" as Route;

const EXACT_ALLOWED_NEXT = new Set<string>([
  "/workspace/teams",
  "/teams/new",
  "/settings/profile",
  "/onboarding/profile",
]);

const PREFIX_ALLOWED_NEXT = ["/workspace/", "/onboarding/"] as const;

export function safeNextPath(raw: string | null | undefined): Route {
  if (!raw || typeof raw !== "string") return DEFAULT_NEXT_PATH;
  const trimmed = raw.trim();
  // Same-origin relative only: must start with single "/" and contain no
  // protocol, backslash, or control characters.
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (trimmed.includes("\\") || trimmed.includes(":")) return DEFAULT_NEXT_PATH;
  if (/[\s<>]/.test(trimmed)) return DEFAULT_NEXT_PATH;
  if (EXACT_ALLOWED_NEXT.has(trimmed)) return trimmed as Route;
  for (const prefix of PREFIX_ALLOWED_NEXT) {
    if (trimmed.startsWith(prefix) && trimmed.length > prefix.length) {
      // Keep the surface narrow: allowlisted prefixes only (path + safe query).
      const [path] = trimmed.split(/[?#]/, 1);
      if (
        path === "/workspace" ||
        path?.startsWith("/workspace/") ||
        path === "/onboarding" ||
        path?.startsWith("/onboarding/")
      ) {
        return trimmed as Route;
      }
    }
  }
  return DEFAULT_NEXT_PATH;
}

/** Signup prefers profile onboarding when `next` is absent. */
export function safeSignupNextPath(raw: string | null | undefined): Route {
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    return SIGNUP_DEFAULT_NEXT_PATH;
  }
  return safeNextPath(raw);
}
