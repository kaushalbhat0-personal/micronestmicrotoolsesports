import type { Platform } from "@/features/sponsor-sentinel/types/platform";

export type VerificationStatus =
  | "VERIFIED"
  | "REJECTED"
  | "UNSUPPORTED"
  | "MALFORMED"
  | "STALE"
  | "REPLAY"
  | "CONFIGURATION_ERROR";

export interface VerifiedWebhookRequest {
  readonly status: "VERIFIED";
  readonly provider: Platform;
  readonly eventId?: string | undefined;
  readonly eventType?: string | undefined;
  readonly timestamp?: string | undefined;
  readonly rawBody: string;
  readonly challenge?: string | undefined; // for Twitch/YouTube verification challenge to echo
  readonly messageType?: string | undefined; // twitch: notification, webhook_callback_verification, revocation
}

export interface VerificationFailure {
  readonly status: Exclude<VerificationStatus, "VERIFIED">;
  readonly provider: Platform | string;
  readonly errorKind: string;
  readonly message: string;
}

export type VerificationResult = VerifiedWebhookRequest | VerificationFailure;

export function isVerified(result: VerificationResult): result is VerifiedWebhookRequest {
  return result.status === "VERIFIED";
}
