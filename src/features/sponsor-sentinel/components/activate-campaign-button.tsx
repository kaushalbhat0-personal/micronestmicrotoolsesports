"use client";

import { useState } from "react";
import { activateCampaignAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import { Button } from "@/components/ui/button";

export function ActivateCampaignButton({
  orgSlug,
  campaignId,
  disabled,
  disabledReason,
}: {
  orgSlug: string;
  campaignId: string;
  disabled?: boolean | undefined;
  disabledReason?: string | undefined;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      const result = await activateCampaignAction(formData);
      if (result?.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      // On success, redirect will have been thrown and handled by Next.js
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to activate campaign";
      if (msg.includes("NEXT_REDIRECT")) throw e;
      setError(msg);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={handle} className="inline-flex">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="campaignId" value={campaignId} />
        <Button
          type="submit"
          size="sm"
          disabled={disabled || pending}
          loading={pending}
          aria-label={pending ? "Starting" : "Start tracking"}
          aria-busy={pending}
          title={disabled ? disabledReason : undefined}
        >
          {pending ? "Starting…" : "Start tracking"}
        </Button>
      </form>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
