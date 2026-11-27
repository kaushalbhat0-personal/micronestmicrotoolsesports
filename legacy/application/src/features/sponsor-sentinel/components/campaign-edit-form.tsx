"use client";

import { useState } from "react";
import { updateCampaignAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CampaignEditInitial {
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
}

/** Convert stored ISO to datetime-local value (UTC wall time, matches create form). */
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export function CampaignEditForm({ orgSlug, campaignId, initial }: { orgSlug: string; campaignId: string; initial: CampaignEditInitial }) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [pending, setPending] = useState(false);

  async function handle(formData: FormData) {
    setPending(true);
    setError(null);
    setFieldErrors(null);
    try {
      const result = await updateCampaignAction(formData);
      if (result?.error) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setPending(false);
        return;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update campaign";
      // Redirect throws NEXT_REDIRECT, must propagate
      if (msg.includes("NEXT_REDIRECT")) throw e;
      setError(msg);
      setPending(false);
    }
  }

  return (
    <form action={handle} className="space-y-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="space-y-2">
        <Label htmlFor="name">Campaign name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial.name}
          placeholder="Spring Sponsor 2026"
          aria-describedby="name-help"
          aria-invalid={Boolean(fieldErrors?.name)}
        />
        <p id="name-help" className="text-xs text-muted-foreground">2–120 characters</p>
        {fieldErrors?.name ? (
          <p role="alert" className="text-xs text-destructive">
            {fieldErrors.name.join("; ")}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          defaultValue={initial.description ?? ""}
          placeholder="Describe the sponsor requirements"
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starts_at">Starts at</Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(initial.starts_at)}
            aria-invalid={Boolean(fieldErrors?.starts_at)}
            aria-describedby={fieldErrors?.starts_at ? "starts_at-error" : undefined}
          />
          {fieldErrors?.starts_at ? (
            <p id="starts_at-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.starts_at.join("; ").replace(/Invalid datetime/g, "Please enter a valid date and time")}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ends_at">Ends at</Label>
          <Input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={toDateTimeLocal(initial.ends_at)}
            aria-invalid={Boolean(fieldErrors?.ends_at)}
            aria-describedby={fieldErrors?.ends_at ? "ends_at-error" : undefined}
          />
          {fieldErrors?.ends_at ? (
            <p id="ends_at-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.ends_at.join("; ").replace(/Invalid datetime/g, "Please enter a valid date and time").replace(/must be after starts_at/i, "End time must be after the start time")}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} loading={pending} aria-busy={pending} aria-label={pending ? "Saving" : "Save changes"}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
