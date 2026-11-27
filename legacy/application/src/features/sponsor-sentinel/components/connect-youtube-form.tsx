"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectYouTubeChannelAction } from "@/features/sponsor-sentinel/actions/channel-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConnectYouTubeForm({ orgSlug, hasCredentials, hasOAuth = true }: { orgSlug: string; hasCredentials: boolean; hasOAuth?: boolean }) {
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
      setMessage("Connect your YouTube account in Connections first.");
      setIsError(true);
      return;
    }
    const trimmed = handle.trim();
    if (!trimmed) {
      setMessage("Enter a valid YouTube channel handle.");
      setIsError(true);
      return;
    }
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("handle", trimmed);
    startTransition(async () => {
      const result = await connectYouTubeChannelAction(fd);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        setIsError(true);
      } else if (result && "success" in result) {
        setMessage("YouTube channel connected ✓");
        setIsError(false);
        setHandle("");
        if (router) router.refresh();
        else if (typeof window !== "undefined") window.location.reload();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!hasCredentials ? (
        <p className="text-xs text-muted-foreground">
          <a href={`/dashboard/${orgSlug}/connections`} className="text-primary underline">
            Connect YouTube
          </a>{" "}
          in Connections first.
        </p>
      ) : !hasOAuth ? (
        <p className="text-xs text-muted-foreground">OAuth is preferred — connecting your YouTube account gives the best results.</p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="youtube-handle">YouTube handle</Label>
        <Input
          id="youtube-handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@GoogleDevelopers or GoogleDevelopers"
          autoComplete="off"
          disabled={pending || !hasCredentials}
        />
        <p className="text-xs text-muted-foreground">Enter handle with or without @. Do not enter a URL.</p>
      </div>
      <Button type="submit" disabled={pending || !hasCredentials} loading={pending} aria-busy={pending} aria-label={pending ? "Connecting" : "Connect YouTube"}>
        {pending ? "Connecting…" : "Connect YouTube"}
      </Button>
      {message ? (
        <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-destructive" : "text-green-600"}`}>
          {message}
          {isError && message.includes("Connect your YouTube account in Connections first") ? (
            <span>
              {" "}
              <a href={`/dashboard/${orgSlug}/connections` as never} className="underline">
                Go to Connections
              </a>
            </span>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
