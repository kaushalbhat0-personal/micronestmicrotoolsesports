"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { removeTeamLogoAction, uploadTeamLogoAction } from "./actions";

/** Team logo upload (Phase C). Reuses finder-avatars; PNG/JPEG/WebP ≤ 512 KB. */
export function TeamLogoForm({
  teamId,
  logoUrl,
}: {
  teamId: string;
  logoUrl: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const outcome = await uploadTeamLogoAction(teamId, new FormData(event.currentTarget));
    setResult(outcome);
    setPending(false);
  }

  async function onRemove() {
    setPending(true);
    setResult(null);
    const outcome = await removeTeamLogoAction(teamId);
    setResult(outcome);
    setPending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team logo</CardTitle>
        <CardDescription>PNG, JPEG, or WebP up to 512 KB. Public to everyone.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Current team logo"
            className="h-20 w-20 rounded-[16px] border border-border object-cover"
          />
        )}
        <form onSubmit={onUpload} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="logo">Upload logo</Label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="mt-1 block min-h-11 w-full text-sm"
            />
          </div>
          <input type="hidden" name="previous_logo_url" value={logoUrl ?? ""} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" loading={pending} className="w-full sm:w-auto">
              Upload logo
            </Button>
            {logoUrl && (
              <Button
                type="button"
                variant="outline"
                onClick={onRemove}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                Remove logo
              </Button>
            )}
          </div>
        </form>
        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={result.ok ? "text-sm text-green-600" : "text-sm text-red-600"}
          >
            {result.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
