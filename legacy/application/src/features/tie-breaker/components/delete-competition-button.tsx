"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteCompetitionAction } from "../actions/competition-actions";

/** Draft deletion only. Locked official records are never offered for deletion. */
export function DeleteCompetitionButton({ orgSlug, competitionId }: { orgSlug: string; competitionId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function onDelete() {
    setError(null);
    setDeleting(true);
    try {
      const result = await deleteCompetitionAction({ orgSlug, competitionId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push(`/dashboard/${orgSlug}/tie-breaker` as Route);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" className="min-h-[44px] text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden /> Delete draft
      </Button>
      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this draft competition?</DialogTitle>
            <DialogDescription>This removes this draft competition and its teams and results. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="destructive" loading={deleting} className="min-h-[44px]" onClick={onDelete}>
              Delete draft
            </Button>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
