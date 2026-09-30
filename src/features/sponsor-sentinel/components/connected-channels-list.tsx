"use client";

import { useTransition, useState } from "react";
import { disconnectChannelAction } from "@/features/sponsor-sentinel/actions/channel-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConnectedChannel } from "@/types/database";

export function ConnectedChannelsList({ orgSlug, channels }: { orgSlug: string; channels: ConnectedChannel[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      } else {
        window.location.reload();
      }
    });
  }

  if (channels.length === 0) {
    return <p className="text-sm text-muted-foreground">No connected channels. Connect a channel to enable Sponsor Sentinel scanning.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {channels.map((ch) => (
          <li key={ch.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">
                {ch.display_name ?? ch.external_handle} <Badge variant="outline">{ch.platform}</Badge>{" "}
                <Badge variant={ch.connection_status === "connected" ? "success" : "secondary"}>{ch.connection_status}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Handle: {ch.external_handle} • ID: {ch.external_channel_id}
              </p>
              <a href={ch.canonical_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                {ch.canonical_url}
              </a>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pendingId === ch.id}
              onClick={() => handleDisconnect(ch.id)}
              aria-label={`Disconnect ${ch.platform} ${ch.external_handle}`}
            >
              {pendingId === ch.id ? "Disconnecting…" : "Disconnect"}
            </Button>
          </li>
        ))}
      </ul>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
