"use client";

import { useState } from "react";
import { createCampaignAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CampaignCreateForm({ orgSlug }: { orgSlug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await createCampaignAction(formData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create campaign";
      // Redirect throws NEXT_REDIRECT, ignore
      if (msg.includes("NEXT_REDIRECT")) throw e;
      setError(msg);
      setPending(false);
    }
  }

  const now = new Date();
  const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <form action={handle} className="space-y-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <div className="space-y-2">
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" name="name" required minLength={2} maxLength={120} placeholder="Spring Sponsor 2026" aria-describedby="name-help" />
        <p id="name-help" className="text-xs text-muted-foreground">2–120 characters</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          placeholder="Describe the sponsor deliverables"
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starts_at">Starts at</Label>
          <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={starts} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ends_at">Ends at</Label>
          <Input id="ends_at" name="ends_at" type="datetime-local" required defaultValue={ends} />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} aria-label="Create campaign">
        {pending ? "Creating…" : "Create draft campaign"}
      </Button>
    </form>
  );
}
