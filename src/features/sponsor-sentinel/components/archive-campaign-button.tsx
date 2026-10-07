"use client";

import { useState } from "react";
import { archiveCampaignAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ArchiveCampaignButton({
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
      const result = await archiveCampaignAction(fd);
      if (result?.error) {
        setError(result.error);
        setPending(false);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to archive campaign";
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
        aria-label="Archive campaign"
        className="min-h-[44px]"
      >
        Archive
      </Button>

      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent onClose={() => !pending && setOpen(false)}>
          <DialogHeader>
            <DialogTitle>Archive campaign?</DialogTitle>
            <DialogDescription>
              This will archive the campaign and stop any tracking. Your checks, proof, and results will remain available in campaign history.
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
              aria-label={pending ? "Archiving" : "Archive campaign"}
              className="min-h-[44px]"
            >
              {pending ? "Archiving…" : "Archive campaign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
