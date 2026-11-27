"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setPrimaryWorkspaceAction } from "./primary-workspace-actions";

/**
 * Primary Workspace marker + setter for the Workspaces list.
 * Preference only — setting it changes no ownership, membership,
 * entitlement, billing, or data.
 */
export function PrimaryWorkspaceButton({
  orgId,
  orgName,
  isPrimary,
}: {
  orgId: string;
  orgName: string;
  isPrimary: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (isPrimary) {
    return <Badge variant="secondary">Primary workspace</Badge>;
  }

  function setPrimary() {
    setError(null);
    startTransition(async () => {
      const result = await setPrimaryWorkspaceAction(orgId);
      if (!result.ok) {
        setError(result.message ?? "Could not set primary workspace.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="outline" size="sm" onClick={setPrimary} disabled={pending} aria-label={`Set ${orgName} as your primary workspace`}>
        {pending ? "Setting…" : "Set as primary"}
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
