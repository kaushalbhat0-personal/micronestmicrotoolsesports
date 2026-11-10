"use client";

import { useState } from "react";
import { deleteDeliverableAction } from "@/features/sponsor-sentinel/actions/deliverable-actions";
import { Button } from "@/components/ui/button";

export function DeleteRequirementButton({
  orgSlug,
  campaignId,
  deliverableId,
  name,
}: {
  orgSlug: string;
  campaignId: string;
  deliverableId: string;
  name: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("campaignId", campaignId);
    fd.set("deliverableId", deliverableId);
    try {
      await deleteDeliverableAction(fd as unknown as FormData);
      // redirect will throw NEXT_REDIRECT
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("NEXT_REDIRECT")) throw err;
      setError(msg);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form onSubmit={handleSubmit}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending}
          loading={pending}
          aria-busy={pending}
          aria-label={pending ? `Removing ${name}` : `Remove requirement ${name}`}
        >
          {pending ? "Removing…" : "Remove"}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="max-w-[20ch] text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
