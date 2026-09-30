import { AppError } from "@/lib/errors";

export function validationError(msg: string, details?: unknown) {
  return new AppError({ code: "VALIDATION_ERROR", status: 400, message: msg, safeMessage: msg, details });
}
export function authorizationError(msg = "Not authorized for organization") {
  return new AppError({ code: "FORBIDDEN", status: 403, message: msg, safeMessage: msg });
}
export function providerError(msg: string, cause?: unknown) {
  return new AppError({ code: "INTEGRATION_ERROR", status: 502, message: msg, safeMessage: msg, cause });
}
export function budgetExceededError(msg: string) {
  return new AppError({ code: "RATE_LIMITED", status: 429, message: msg, safeMessage: msg });
}
export function unsupportedCapabilityError(msg: string) {
  return new AppError({ code: "VALIDATION_ERROR", status: 400, message: msg, safeMessage: msg });
}
export function persistenceError(msg: string, cause?: unknown) {
  return new AppError({ code: "INTERNAL_ERROR", status: 500, message: msg, safeMessage: "Persistence failed", cause });
}
export function scanExecutionError(msg: string, cause?: unknown) {
  return new AppError({ code: "INTERNAL_ERROR", status: 500, message: msg, safeMessage: msg, cause });
}
