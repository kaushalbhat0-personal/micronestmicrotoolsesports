import { Badge } from "@/components/ui/badge";

/**
 * Finder — verification badge.
 *
 * Verified means ONLY: MicroNest reviewed evidence that this profile
 * controls the claimed BGMI account. Never skill, rank, K/D, or
 * tournament success. Unverified profiles must never imply ownership
 * verification.
 */
export function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge variant="success" title="MicroNest reviewed evidence that this profile controls the claimed BGMI account. This is not a skill or rank verification.">
        BGMI Account Verified
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" title="This profile entered an IGN and Character ID, but MicroNest has not verified account ownership.">
      Unverified
    </Badge>
  );
}
