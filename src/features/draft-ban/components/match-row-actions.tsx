"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteDraftMatchAction, duplicateDraftMatchAction } from "../actions/match-actions";

export function MatchRowActions({ orgSlug, matchId, status }: { orgSlug: string; matchId: string; status: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function duplicate() {
    setError(null);
    setPending(true);
    try {
      const result = await duplicateDraftMatchAction({ orgSlug, matchId });
      if (result.error || !result.matchId) {
        setError(result.error ?? "Failed to duplicate");
        return;
      }
      router.push(`/dashboard/${orgSlug}/draft-ban/${result.matchId}` as Route);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setError(null);
    setPending(true);
    try {
      const result = await deleteDraftMatchAction({ orgSlug, matchId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmDelete(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="min-h-[44px]" disabled={pending} onClick={duplicate} aria-label="Duplicate and run again">
        Run again
      </Button>
      <Button variant="ghost" size="sm" className="min-h-[44px]" disabled={pending} onClick={() => setConfirmDelete(true)} aria-label="Delete draft record">
        Delete
      </Button>
      {error && (
        <span role="alert" className="w-full text-xs text-destructive">
          {error}
        </span>
      )}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent onClose={() => setConfirmDelete(false)}>
          <DialogHeader>
            <DialogTitle>Delete this record{status === "completed" ? " (locked official record)" : ""}?</DialogTitle>
            <DialogDescription>This permanently removes the draft {status === "completed" ? "and invalidates its share link" : "and its recorded actions"}.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} className="min-h-[44px]">
              Keep
            </Button>
            <Button variant="destructive" onClick={remove} className="min-h-[44px]" aria-label="Confirm delete">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
