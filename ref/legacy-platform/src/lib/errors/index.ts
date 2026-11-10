/**
 * Consistent error model.
 * Differentiate error types; never expose internals to clients.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ENTITLEMENT_REQUIRED"
  | "RATE_LIMITED"
  | "INTEGRATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Safe message for clients. Original details are logged server-side. */
  readonly safeMessage: string;
  /** Optional extra details for validation errors */
  readonly details?: unknown;
  override cause?: unknown;

  constructor(opts: { code: ErrorCode; status: number; message: string; safeMessage?: string; details?: unknown; cause?: unknown }) {
    super(opts.message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "AppError";
    this.code = opts.code;
    this.status = opts.status;
    this.safeMessage = opts.safeMessage ?? opts.message;
    this.details = opts.details;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

export function validationError(message: string, details?: unknown) {
  return new AppError({ code: "VALIDATION_ERROR", status: 400, message, safeMessage: message, details });
}

export function authenticationError(message = "Authentication required") {
  return new AppError({ code: "AUTHENTICATION_REQUIRED", status: 401, message, safeMessage: message });
}

export function forbiddenError(message = "Forbidden") {
  return new AppError({ code: "FORBIDDEN", status: 403, message, safeMessage: message });
}

export function notFoundError(message = "Not found") {
  return new AppError({ code: "NOT_FOUND", status: 404, message, safeMessage: message });
}

export function conflictError(message: string) {
  return new AppError({ code: "CONFLICT", status: 409, message, safeMessage: message });
}

export function entitlementError(message = "This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.") {
  return new AppError({ code: "ENTITLEMENT_REQUIRED", status: 403, message, safeMessage: message });
}

/**
 * Typed access-denied check for tool-page gates.
 * Lets server pages render a customer-facing access screen for the expected
 * entitlement case without relying on error-boundary message sniffing
 * (which production error redaction defeats). Any other error must rethrow.
 */
export function isEntitlementDenied(error: unknown): boolean {
  return error instanceof AppError && error.code === "ENTITLEMENT_REQUIRED";
}

export function integrationError(message: string, cause?: unknown) {
  return new AppError({ code: "INTEGRATION_ERROR", status: 502, message, safeMessage: "External service error", cause });
}

export function internalError(message = "Internal server error", cause?: unknown) {
  return new AppError({ code: "INTERNAL_ERROR", status: 500, message, safeMessage: "Something went wrong. Please try again.", cause });
}

/** Map AppError to a safe JSON response */
export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.safeMessage,
        ...(error.details ? { details: error.details } : {}),
      },
      status: error.status,
    };
  }
  // Unknown error — never leak internals
  return {
    error: { code: "INTERNAL_ERROR" as ErrorCode, message: "Something went wrong. Please try again." },
    status: 500,
  };
}

/** Handle route errors consistently — use in try/catch of route handlers */
export function handleRouteError(error: unknown): Response {
  const { error: body, status } = toErrorResponse(error);
  // Log server-side (avoid logging in tests if needed)
  if (status >= 500) {
    console.error("[InternalError]", error);
  } else {
    console.warn(`[AppError ${body.code}]`, body.message);
  }
  return Response.json(body, { status });
}
