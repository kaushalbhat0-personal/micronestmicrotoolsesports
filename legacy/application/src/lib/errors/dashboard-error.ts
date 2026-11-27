import { AppError } from "@/lib/errors";

/**
 * Customer-safe dashboard error mapping.
 *
 * The dashboard error boundary must NEVER render `error.message` directly:
 * it can contain internal terminology ("Authentication required",
 * "AUTHENTICATION_REQUIRED"), raw database/Supabase errors, or stack
 * details. This helper maps any thrown value to a fixed, plain-language
 * view model. Unknown/internal errors collapse to a generic message.
 */

export type DashboardErrorKind = "authentication" | "access" | "generic";

export type DashboardErrorView = {
  kind: DashboardErrorKind;
  title: string;
  message: string;
  /** Primary action for authentication failures. Never retry-loop. */
  showLogin: boolean;
  /** Retry/reload is only offered for genuinely retryable failures. */
  showRetry: boolean;
};

const ACCESS_MESSAGE = "This tool isn't active for your workspace yet.";

export function mapDashboardError(error: unknown): DashboardErrorView {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";

  if (error instanceof AppError && error.code === "AUTHENTICATION_REQUIRED") {
    return {
      kind: "authentication",
      title: "Session expired",
      message: "Your session has expired. Sign in again to continue.",
      showLogin: true,
      showRetry: false,
    };
  }

  if (
    error instanceof AppError &&
    error.code === "ENTITLEMENT_REQUIRED"
  ) {
    return {
      kind: "access",
      title: "Tool not active",
      message: ACCESS_MESSAGE,
      showLogin: false,
      showRetry: false,
    };
  }

  if (
    /authentication required|authentication_required|auth session missing|session missing|not authenticated|invalid jwt|jwt expired|token .*expired|unauthorized|401/i.test(
      raw
    )
  ) {
    return {
      kind: "authentication",
      title: "Session expired",
      message: "Your session has expired. Sign in again to continue.",
      showLogin: true,
      showRetry: false,
    };
  }

  if (raw.includes(ACCESS_MESSAGE)) {
    return {
      kind: "access",
      title: "Tool not active",
      message: ACCESS_MESSAGE,
      showLogin: false,
      showRetry: false,
    };
  }

  return {
    kind: "generic",
    title: "Something went wrong",
    message: "Something went wrong. Please try again. If the problem continues, contact support.",
    showLogin: false,
    showRetry: true,
  };
}
