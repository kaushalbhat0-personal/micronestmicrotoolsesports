"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectKickChannelAction } from "@/features/sponsor-sentinel/actions/channel-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectKickForm({ orgSlug, hasCredentials }: { orgSlug: string; hasCredentials: boolean }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [handle, setHandle] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!hasCredentials) {
      setMessage("Connect your Kick API access first.");
      setIsError(true);
      return;
    }
    const trimmed = handle.trim();
    if (!trimmed) {
      setMessage("Enter a valid Kick channel handle.");
      setIsError(true);
      return;
    }
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("handle", trimmed);
    startTransition(async () => {
      const result = await connectKickChannelAction(fd);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        setIsError(true);
      } else if (result && "success" in result) {
        setMessage("Kick channel connected ✓");
        setIsError(false);
        setHandle("");
        if (router) router.refresh();
        else if (typeof window !== "undefined") window.location.reload();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="kick-handle">Kick channel</Label>
        <Input
          id="kick-handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="creator handle"
          autoComplete="off"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">Enter the Kick slug, e.g., creator handle. Do not enter a URL.</p>
      </div>
      <Button type="submit" disabled={pending} loading={pending} aria-busy={pending} aria-label={pending ? "Connecting" : "Connect Kick"}>
        {pending ? "Connecting…" : "Connect Kick"}
      </Button>
      {message ? (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-destructive" : "text-green-600"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
