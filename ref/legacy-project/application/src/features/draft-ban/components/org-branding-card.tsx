"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgLogo } from "./org-logo";
import { removeOrgLogoAction, uploadOrgLogoAction } from "../actions/org-branding-actions";

export function OrgBrandingCard({
  orgSlug,
  orgName,
  logoUrl,
  canManage,
  brandingEnabled,
}: {
  orgSlug: string;
  orgName: string;
  logoUrl: string | null;
  canManage: boolean;
  /**
   * Whether the workspace's paid Draft & Ban coverage renders the logo on
   * official results/share output. Resolved server-side by the caller
   * (never from browser state) — this card only presents the resulting copy.
   */
  brandingEnabled: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("orgSlug", orgSlug);
      formData.set("logo", file);
      const result = await uploadOrgLogoAction(formData);
      if (result.error) setError(result.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace branding</CardTitle>
        <CardDescription>
          {brandingEnabled
            ? "Your name and logo appear on every official draft record. PNG, JPEG, or WebP up to 512 KB."
            : "Your name appears on every official draft record. Your logo is stored and will appear after upgrading. PNG, JPEG, or WebP up to 512 KB."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <OrgLogo name={orgName} logoUrl={logoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{orgName}</p>
          <p className="text-xs text-muted-foreground">
            {!logoUrl
              ? "No logo yet — initials are shown instead."
              : brandingEnabled
                ? "Logo shown on official results."
                : "Logo stored — official results use your workspace initials. Upgrade to show your logo."}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-[13px] font-medium hover:bg-muted">
              {pending ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={pending}
                onChange={(e) => onFile(e.target.files?.[0])}
                aria-label="Upload organization logo"
              />
            </label>
            {logoUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
                disabled={pending}
                onClick={async () => {
                  const result = await removeOrgLogoAction({ orgSlug });
                  if (result.error) setError(result.error);
                }}
              >
                Remove
              </Button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="w-full rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
