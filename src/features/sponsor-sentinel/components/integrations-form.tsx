"use client";

import * as React from "react";
import { useState } from "react";
import { saveProviderCredential, testProviderCredential, deleteProviderCredential } from "@/features/sponsor-sentinel/actions/integration-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeKolkata } from "@/lib/utils/format";
import Link from "next/link";

type Masked = {
  configured: boolean;
  clientIdMasked?: string | null;
  apiKeyMasked?: string | null;
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  hasOAuth?: boolean;
  externalAccountLogin?: string | null;
  authorizedAt?: string | null;
};

function ProviderCard({
  orgSlug,
  provider,
  title,
  description,
  masked,
  fields,
  connectedDescription,
  accentColor,
}: {
  orgSlug: string;
  provider: "twitch" | "youtube" | "kick";
  title: string;
  description: string;
  masked: Masked;
  fields: Array<{ name: string; label: string; placeholder: string; type?: string }>;
  connectedDescription?: string;
  accentColor?: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  async function handleSave(formData: FormData) {
    setMessage(null);
    setIsError(false);
    setPending(true);
    try {
      const res = await saveProviderCredential(formData);
      if (res.ok) {
        setMessage("Connection saved");
        setIsError(false);
      } else {
        setMessage(res.error);
        setIsError(true);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
      setMessage(e instanceof Error ? e.message : "Save failed");
      setIsError(true);
    } finally {
      setPending(false);
    }
  }

  async function handleTest(formData: FormData) {
    setMessage(null);
    setIsError(false);
    setIsTesting(true);
    try {
      const res = await testProviderCredential(formData);
      if (res.ok) {
        setMessage("Connection is working");
        setIsError(false);
      } else {
        const kind = res.errorKind ?? "unknown";
        let friendly = "We couldn't connect. Check your credentials.";
        if (kind === "auth") friendly = provider === "youtube" ? "We couldn't connect to YouTube. Reconnect via OAuth and ensure the YouTube Data API is enabled." : "We couldn't connect. Check your Client ID and Secret.";
        else if (kind === "quota_exceeded") friendly = "YouTube's daily API limit has been reached. Try again later.";
        else if (kind === "not_configured") friendly = provider === "youtube" ? "Connect YouTube via OAuth to enable this feature." : "Add your credentials first.";
        else if (res.error) friendly = res.error;
        setMessage(friendly);
        setIsError(true);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
      setMessage(e instanceof Error ? e.message : "Test failed");
      setIsError(true);
    } finally {
      setIsTesting(false);
    }
  }

  async function handleDelete(formData: FormData) {
    setMessage(null);
    setPending(true);
    try {
      const res = await deleteProviderCredential(formData);
      if (res.ok) {
        setMessage("Connection removed");
        setIsError(false);
      } else {
        setMessage(res.error);
        setIsError(true);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
      setMessage(e instanceof Error ? e.message : "Remove failed");
      setIsError(true);
    } finally {
      setPending(false);
    }
  }

  const isConfigured = masked.configured;
  const testStatus = masked.lastTestStatus;
  const isConnected = isConfigured && testStatus === "success";

  // Provider accent
  const accent = accentColor ?? (provider === "twitch" ? "bg-purple-500" : provider === "youtube" ? "bg-red-500" : "bg-green-500");

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${accent}`} aria-hidden />
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${accent}`}>{title[0]}</span>
          {title}
          {isConnected ? (
            <Badge variant="success">Connected ✓</Badge>
          ) : isConfigured ? (
            <Badge variant="secondary">Configured</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
          {testStatus ? (
            <Badge variant={testStatus === "success" ? "success" : "destructive"}>{testStatus === "success" ? "Test: Connected ✓" : "Test: Failed"}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>{isConfigured && connectedDescription ? connectedDescription : description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {provider === "twitch" ? (
          <div className="rounded-md border p-3 space-y-2">
            {masked.hasOAuth && masked.externalAccountLogin ? (
              <p className="text-sm">
                Connected as <span className="font-medium">{masked.externalAccountLogin}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Connect your Twitch account with one click — no Client ID needed.</p>
            )}
            <Link href={`/api/auth/twitch/start?orgSlug=${encodeURIComponent(orgSlug)}` as never}>
              <Button variant={masked.hasOAuth ? "outline" : "default"} size="sm" aria-label={masked.hasOAuth ? "Reconnect Twitch" : "Connect Twitch"}>
                {masked.hasOAuth ? "Reconnect Twitch" : "Connect Twitch"}
              </Button>
            </Link>
            {masked.hasOAuth && masked.authorizedAt ? (
              <p className="text-xs text-muted-foreground">Authorized: {formatDateTimeKolkata(masked.authorizedAt)}</p>
            ) : null}
          </div>
        ) : null}
        {provider === "youtube" ? (
          <div className="rounded-md border p-3 space-y-2">
            {masked.hasOAuth && masked.externalAccountLogin ? (
              <p className="text-sm">
                Connected as <span className="font-medium">{masked.externalAccountLogin}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Connect your YouTube account with one click — no API key needed.</p>
            )}
            <Link href={`/api/auth/youtube/start?orgSlug=${encodeURIComponent(orgSlug)}` as never}>
              <Button variant={masked.hasOAuth ? "outline" : "default"} size="sm" aria-label={masked.hasOAuth ? "Reconnect YouTube" : "Connect YouTube"}>
                {masked.hasOAuth ? "Reconnect YouTube" : "Connect YouTube"}
              </Button>
            </Link>
            {masked.hasOAuth && masked.authorizedAt ? (
              <p className="text-xs text-muted-foreground">Authorized: {formatDateTimeKolkata(masked.authorizedAt)}</p>
            ) : null}
          </div>
        ) : null}
        {provider === "kick" ? (
          <div className="rounded-md border p-3 space-y-2">
            {masked.hasOAuth && masked.externalAccountLogin ? (
              <p className="text-sm">
                Connected as <span className="font-medium">{masked.externalAccountLogin}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Connect your Kick account with one click — no Client ID needed.</p>
            )}
            <Link href={`/api/auth/kick/start?orgSlug=${encodeURIComponent(orgSlug)}` as never}>
              <Button variant={masked.hasOAuth ? "outline" : "default"} size="sm" aria-label={masked.hasOAuth ? "Reconnect Kick" : "Connect Kick"}>
                {masked.hasOAuth ? "Reconnect Kick" : "Connect Kick"}
              </Button>
            </Link>
            {masked.hasOAuth && masked.authorizedAt ? (
              <p className="text-xs text-muted-foreground">Authorized: {formatDateTimeKolkata(masked.authorizedAt)}</p>
            ) : null}
          </div>
        ) : null}
        {isConfigured ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            {masked.lastTestedAt ? (
              <p className="text-xs text-muted-foreground">Last tested: {formatDateTimeKolkata(masked.lastTestedAt)}</p>
            ) : masked.hasOAuth ? (
              <p className="text-xs text-muted-foreground">OAuth connection authorized — test the connection before adding creator channels.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Not yet tested — test the connection before adding creator channels.</p>
            )}
            <form action={handleDelete} className="pt-2">
              <input type="hidden" name="orgSlug" value={orgSlug} />
              <input type="hidden" name="provider" value={provider} />
              <Button type="submit" variant="ghost" size="sm" disabled={pending || isTesting} aria-label={`Remove ${title} connection`}>
                Remove connection
              </Button>
            </form>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">{title} isn’t connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              {provider === "youtube"
                ? "Connect your YouTube account via OAuth to verify creator channels."
                : provider === "twitch"
                  ? "Connect your Twitch account via OAuth to verify creator channels."
                  : "Connect your Kick account via OAuth to verify creator channels."}
            </p>
          </div>
        )}

        {fields.length > 0 ? (
          <form action={handleSave} className="space-y-3">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="provider" value={provider} />
            {fields.map((f) => (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`${provider}-${f.name}`}>{f.label}</Label>
                <Input id={`${provider}-${f.name}`} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} autoComplete="off" />
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || isTesting} aria-label={`Save ${title} connection`}>
                {pending ? "Saving…" : isConfigured ? "Update connection" : "Save connection"}
              </Button>
            </div>
          </form>
        ) : provider === "kick" ? (
          <p className="text-sm text-muted-foreground">Kick connection is coming soon. We’re preparing the platform for Sponsor Sentinel.</p>
        ) : null}

        {isConfigured ? (
          <form action={handleTest}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="provider" value={provider} />
            <Button type="submit" variant="outline" size="sm" disabled={pending || isTesting} aria-label={`Test ${title} connection`}>
              {isTesting ? "Testing…" : testStatus === "success" ? "Test again" : "Test connection"}
            </Button>
          </form>
        ) : null}

        {message ? (
          <p role={isError ? "alert" : "status"} className={`text-sm ${isError ? "text-destructive" : "text-green-600"}`}>
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function IntegrationsForm({
  orgSlug,
  twitch,
  youtube,
  kick,
}: {
  orgSlug: string;
  twitch: Masked;
  youtube: Masked;
  kick: Masked;
}) {
  return (
    <div className="space-y-6">
      <ProviderCard
        orgSlug={orgSlug}
        provider="twitch"
        title="Twitch"
        description="Connect Twitch so we can verify activity on creator channels."
        connectedDescription="Twitch connection is working. You can now connect creator channels."
        masked={twitch}
        fields={[]}
      />
      <ProviderCard
        orgSlug={orgSlug}
        provider="youtube"
        title="YouTube"
        description="Connect YouTube so we can verify creator channel activity."
        connectedDescription="YouTube connection is working. You can now connect creator channels."
        masked={youtube}
        fields={[]}
      />
      <ProviderCard
        orgSlug={orgSlug}
        provider="kick"
        title="Kick"
        description="Connect Kick so we can verify activity on creator channels."
        connectedDescription="Kick connection is working. You can now connect creator channels."
        masked={kick}
        fields={[]}
      />
    </div>
  );
}
