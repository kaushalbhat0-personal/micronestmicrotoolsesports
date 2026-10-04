"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectTwitchChannelAction } from "@/features/sponsor-sentinel/actions/channel-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectTwitchForm({ orgSlug, hasCredentials }: { orgSlug: string; hasCredentials: boolean }) {
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
      setMessage("Connect your Twitch API access first.");
      setIsError(true);
      return;
    }
    const trimmed = handle.trim();
    if (!trimmed) {
      setMessage("Enter a valid Twitch channel handle.");
      setIsError(true);
      return;
    }
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("handle", trimmed);
    startTransition(async () => {
      const result = await connectTwitchChannelAction(fd);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        setIsError(true);
      } else if (result && "success" in result) {
        setMessage("Twitch channel connected ✓");
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
        <Label htmlFor="twitch-handle">Twitch channel</Label>
        <Input
          id="twitch-handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="creator handle"
          autoComplete="off"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">Enter the Twitch login, e.g., creator handle. Do not enter a URL.</p>
      </div>
      <Button type="submit" disabled={pending} loading={pending} aria-busy={pending} aria-label={pending ? "Connecting" : "Connect Twitch"}>
        {pending ? "Connecting…" : "Connect Twitch"}
      </Button>
      {message ? (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-destructive" : "text-green-600"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
