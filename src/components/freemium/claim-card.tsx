import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

/**
 * ClaimCard — presents a Free-tool claim interaction.
 *
 * Fully controlled and presentational: the caller owns eligibility,
 * execution, and messaging. `onClaim` runs on activation; `status` drives
 * loading/disabled/error/success rendering; `error` must be a
 * caller-supplied customer-safe string (server errors stay caller-owned —
 * this component never manufactures quota text and never touches data,
 * policy, or payment layers).
 */

export type ClaimStatus = "idle" | "loading" | "error" | "success";

export function ClaimCard({
  toolName,
  description,
  limits,
  claimLabel = "Start free",
  status = "idle",
  error,
  successMessage,
  onClaim,
  className,
}: {
  /** Tool display name, e.g. "Sponsorship Tracking". */
  toolName: string;
  /** Bespoke supporting copy supplied by the caller. */
  description?: string | undefined;
  /** Bespoke limits copy supplied by the caller. */
  limits?: string | undefined;
  /** Claim button text. Defaults to "Start free". */
  claimLabel?: string | undefined;
  /** Controlled interaction state, owned by the caller. */
  status?: ClaimStatus | undefined;
  /** Customer-safe error text from the claim result. Rendered verbatim. */
  error?: string | undefined;
  /** Confirmation text shown after a successful claim. */
  successMessage?: string | undefined;
  /** Caller-owned claim execution. Invoked on button activation only. */
  onClaim: () => void;
  className?: string;
}) {
  const loading = status === "loading";
  return (
    <section aria-label={`Try ${toolName} free`} className={cn(className)}>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-sm">Try {toolName} free</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          {limits ? <p className="mb-3 text-xs text-muted-foreground">{limits}</p> : null}
          {status === "error" && error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {status === "success" && successMessage ? (
            <p className="mb-3 text-sm" role="status">
              {successMessage}
            </p>
          ) : null}
          <Button size="sm" className="min-h-[44px]" disabled={loading} loading={loading} aria-busy={loading} onClick={onClaim}>
            {claimLabel}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
