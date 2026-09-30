"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { saveProviderCredential, testProviderCredential, deleteProviderCredential } from "@/features/sponsor-sentinel/actions/integration-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Masked = { configured: boolean; clientIdMasked?: string | null; apiKeyMasked?: string | null; lastTestedAt?: string | null; lastTestStatus?: string | null };

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
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  async function handleSave(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveProviderCredential(formData);
        setMessage("Connection saved");
        setIsError(false);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Save failed");
        setIsError(true);
      }
    });
  }

  async function handleTest(formData: FormData) {
    setMessage(null);
    setIsTesting(true);
    startTransition(async () => {
      const res = await testProviderCredential(formData);
      setIsTesting(false);
      if (res.ok) {
        setMessage("Connection is working");
        setIsError(false);
      } else {
        const kind = res.errorKind ?? "unknown";
        let friendly = "We couldn't connect. Check your credentials.";
        if (kind === "auth") friendly = provider === "youtube" ? "We couldn't connect to YouTube. Check your API key and make sure the YouTube Data API is enabled." : "We couldn't connect. Check your Client ID and Secret.";
        else if (kind === "quota_exceeded") friendly = "YouTube's daily API limit has been reached. Try again later.";
        else if (kind === "not_configured") friendly = provider === "youtube" ? "Add your YouTube API key first." : "Add your credentials first.";
        setMessage(friendly);
        setIsError(true);
      }
    });
  }

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      await deleteProviderCredential(formData);
      setMessage("Connection removed");
      setIsError(false);
    });
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
        {isConfigured ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-1">
            {masked.clientIdMasked ? (
              <p className="text-sm">
                Client ID: <code className="bg-muted px-1 rounded">{masked.clientIdMasked}</code>
              </p>
            ) : null}
            {masked.apiKeyMasked ? (
              <p className="text-sm">
                API key: <code className="bg-muted px-1 rounded">{masked.apiKeyMasked}</code> <span className="text-muted-foreground">••••••••••••••••••</span>
              </p>
            ) : null}
            {provider !== "youtube" ? <p className="text-sm">Client Secret: <span className="text-muted-foreground">••••••••••••••••••</span></p> : null}
            {masked.lastTestedAt ? <p className="text-xs text-muted-foreground">Last tested: {new Date(masked.lastTestedAt).toLocaleString()}</p> : <p className="text-xs text-muted-foreground">Not yet tested — test the connection before adding creator channels.</p>}
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
                ? "Add your YouTube API key so we can verify creator channels."
                : provider === "twitch"
                  ? "Add your Twitch Client ID and Secret so we can verify creator channels."
                  : "We're preparing this platform for Sponsor Sentinel."}
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
                <Input id={`${provider}-${f.name}`} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} autoComplete="off" aria-describedby={f.name === "apiKey" ? `${provider}-key-help` : undefined} />
                {f.name === "apiKey" ? <p id={`${provider}-key-help`} className="text-xs text-muted-foreground">You can create a key in Google Cloud Console → APIs &amp; Services → Credentials.</p> : null}
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || isTesting} aria-label={`Save ${title} connection`}>
                {pending ? "Saving…" : isConfigured ? "Update connection" : "Save connection"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Kick connection is coming soon. We’re preparing the platform for Sponsor Sentinel.</p>
        )}

        {isConfigured && fields.length > 0 ? (
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
        fields={[
          { name: "clientId", label: "Client ID", placeholder: "Twitch Client ID" },
          { name: "clientSecret", label: "Client Secret", placeholder: "••••••••••", type: "password" },
        ]}
      />
      <ProviderCard
        orgSlug={orgSlug}
        provider="youtube"
        title="YouTube"
        description="Connect YouTube so we can verify creator channel activity."
        connectedDescription="YouTube connection is working. You can now connect creator channels."
        masked={youtube}
        fields={[{ name: "apiKey", label: "API key", placeholder: "YouTube API key", type: "password" }]}
      />
      <ProviderCard
        orgSlug={orgSlug}
        provider="kick"
        title="Kick"
        description="Kick connection is coming soon. We're preparing the platform connection for Sponsor Sentinel."
        masked={kick}
        fields={[]}
      />
    </div>
  );
}
