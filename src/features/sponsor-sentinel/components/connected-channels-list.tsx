"use client";

import * as React from "react";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectChannelAction } from "@/features/sponsor-sentinel/actions/channel-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ConnectedChannel } from "@/types/database";

export function ConnectedChannelsList({ orgSlug, channels }: { orgSlug: string; channels: ConnectedChannel[] }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    router = null;
  }
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDisconnect(channelId: string) {
    setMessage(null);
    setPendingId(channelId);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("channelId", channelId);
    startTransition(async () => {
      const result = await disconnectChannelAction(fd);
      if (result && "error" in result && result.error) {
        setMessage(result.error);
        setPendingId(null);
        setConfirmId(null);
      } else {
        setPendingId(null);
        setConfirmId(null);
        if (router) router.refresh();
        else if (typeof window !== "undefined") window.location.reload();
      }
    });
  }

  if (channels.length === 0) {
    return (
      <EmptyState
        icon={<span aria-hidden>📺</span>}
        title="No creator channels connected"
        description="Connect a Twitch or YouTube channel to start tracking sponsorship activity. Campaigns will use these channels to check for proof."
        action={
          <a href="#connect-youtube" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Connect a channel
          </a>
        }
      />
    );
  }

  const providerColor = (platform: string) => {
    if (platform === "twitch") return "bg-purple-500";
    if (platform === "youtube") return "bg-red-500";
    if (platform === "kick") return "bg-green-500";
    return "bg-muted";
  };

  const channelToConfirm = channels.find((c) => c.id === confirmId);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {channels.map((ch) => (
          <li key={ch.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${providerColor(ch.platform)}`}>{ch.platform.charAt(0).toUpperCase()}</span>
                {ch.display_name ?? ch.external_handle}
                <Badge variant="outline" className="capitalize">
                  {ch.platform}
                </Badge>
                <Badge variant={ch.connection_status === "connected" ? "success" : "secondary"}>Connected ✓</Badge>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ch.external_handle} • {ch.platform === "youtube" ? "YouTube" : ch.platform === "twitch" ? "Twitch" : "Kick"}
              </p>
              <a href={ch.canonical_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                Open channel
              </a>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pendingId === ch.id}
              aria-busy={pendingId === ch.id}
              onClick={() => setConfirmId(ch.id)}
              aria-label={`Disconnect ${ch.platform} ${ch.external_handle}`}
            >
              Disconnect
            </Button>
          </li>
        ))}
      </ul>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <Dialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent onClose={() => setConfirmId(null)}>
          <DialogHeader>
            <DialogTitle>Disconnect this creator channel?</DialogTitle>
            <DialogDescription>Campaigns will no longer be able to check this channel for sponsorship proof. The channel can be reconnected later.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pendingId === channelToConfirm?.id}
              loading={pendingId === channelToConfirm?.id}
              aria-busy={pendingId === channelToConfirm?.id}
              onClick={() => channelToConfirm && handleDisconnect(channelToConfirm.id)}
            >
              {pendingId === channelToConfirm?.id ? "Disconnecting…" : "Disconnect channel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
