"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { applyToPostAction } from "./actions";

/**
 * Player application CTA (Phase C). Logged-out players are sent to
 * signup; players with an active application see state instead.
 */
export function ApplyButton({
  postId,
  signedIn,
  alreadyApplied,
}: {
  postId: string;
  signedIn: boolean;
  alreadyApplied: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!signedIn) {
    return (
      <Link href={"/signup" as Route} className="w-full sm:w-auto">
        <Button className="w-full sm:w-auto">Log in to apply</Button>
      </Link>
    );
  }

  if (alreadyApplied && !result) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Application sent — track it in{" "}
        <Link href={"/me/applications" as Route} className="text-primary underline">
          my applications
        </Link>
        .
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    const note = String(form.get("note") ?? "").trim() || undefined;
    const outcome = await applyToPostAction(postId, note);
    setResult(outcome);
    setPending(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        Apply to this role
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <Label htmlFor={`note-${postId}`}>Note to the captain (optional)</Label>
        <textarea
          id={`note-${postId}`}
          name="note"
          maxLength={200}
          rows={2}
          placeholder="e.g. Assaulter, weekday evenings, ready for tryout"
          className="mt-1 flex w-full rounded-[12px] border border-input bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "text-sm text-green-600" : "text-sm text-red-600"}
        >
          {result.message}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" loading={pending} className="w-full sm:w-auto">
          Send application
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
