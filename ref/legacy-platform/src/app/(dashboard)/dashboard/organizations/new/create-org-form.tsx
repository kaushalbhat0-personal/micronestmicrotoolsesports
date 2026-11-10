"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export function CreateOrgForm({ action, planName }: { action: (fd: FormData) => Promise<void>; planName?: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(fd: FormData) {
    setPending(true);
    setError(null);
    try {
      await action(fd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create workspace";
      if (msg.includes("NEXT_REDIRECT")) throw e;
      setError(msg);
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Create workspace" description="Create a new workspace. You will be the owner." />
      {planName ? (
        <p className="rounded-[12px] border border-primary/20 bg-primary/5 p-4 text-sm" role="status" aria-live="polite">
          Continuing with {planName} — after creating your workspace you&apos;ll continue to payment in Billing.
        </p>
      ) : null}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Workspace details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required minLength={2} maxLength={80} placeholder="Acme Esports" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Web address name (optional, filled in from the name if empty)</Label>
              <Input id="slug" name="slug" pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" placeholder="acme-esports" />
              <p className="text-xs text-muted-foreground">Used in your workspace web address. Lowercase letters, numbers, hyphens. 2–40 chars.</p>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending} loading={pending} aria-busy={pending} aria-label={pending ? "Creating" : "Create workspace"}>
              {pending ? "Creating…" : "Create workspace"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
