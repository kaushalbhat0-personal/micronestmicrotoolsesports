"use client";

import { useState } from "react";
import { completeCampaignAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function CompleteCampaignButton({
  orgSlug,
  campaignId,
}: {
  orgSlug: string;
  campaignId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("campaignId", campaignId);
    try {
      const result = await completeCampaignAction(fd);
      if (result?.error) {
        setError(result.error);
        setPending(false);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to complete campaign";
      if (msg.includes("NEXT_REDIRECT")) throw e;
      setError(msg);
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label="Complete campaign"
      >
        Complete campaign
      </Button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent onClose={() => !pending && setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Complete campaign?</DialogTitle>
            <DialogDescription>
              This will stop active tracking for this campaign. Your checks, proof, and results will remain available in campaign history.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending} className="min-h-[44px]">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={pending}
              loading={pending}
              aria-busy={pending}
              aria-label={pending ? "Completing" : "Complete campaign"}
              className="min-h-[44px]"
            >
              {pending ? "Completing…" : "Complete campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
