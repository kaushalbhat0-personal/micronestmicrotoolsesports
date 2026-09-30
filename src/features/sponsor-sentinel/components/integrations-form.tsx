"use client";

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
}: {
  orgSlug: string;
  provider: "twitch" | "youtube" | "kick";
  title: string;
  description: string;
  masked: Masked;
  fields: Array<{ name: string; label: string; placeholder: string; type?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSave(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveProviderCredential(formData);
        setMessage("Saved");
        setIsError(false);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Save failed");
        setIsError(true);
      }
    });
  }

  async function handleTest(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const res = await testProviderCredential(formData);
      if (res.ok) {
        setMessage("✓ Credentials are valid");
        setIsError(false);
      } else {
        setMessage(`✗ ${res.errorKind ?? "Could not verify"}`);
        setIsError(true);
      }
    });
  }

  async function handleDelete(formData: FormData) {
    startTransition(async () => {
      await deleteProviderCredential(formData);
      setMessage("Deleted");
      setIsError(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {title} {masked.configured ? <Badge variant="success">Configured ✓</Badge> : <Badge variant="secondary">Not configured</Badge>}
          {masked.lastTestStatus ? <Badge variant={masked.lastTestStatus === "success" ? "success" : "destructive"}>{masked.lastTestStatus}</Badge> : null}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {masked.configured ? (
          <div className="rounded-md border p-3 space-y-1">
            {masked.clientIdMasked ? <p className="text-sm">Client ID: <code className="bg-muted px-1">{masked.clientIdMasked}</code></p> : null}
            {masked.apiKeyMasked ? <p className="text-sm">API Key: <code className="bg-muted px-1">{masked.apiKeyMasked}</code></p> : null}
            <p className="text-sm">Client Secret: Configured ✓ <span className="text-muted-foreground">[Replace below]</span></p>
            {masked.lastTestedAt ? <p className="text-xs text-muted-foreground">Last tested: {new Date(masked.lastTestedAt).toLocaleString()}</p> : null}
            <form action={handleDelete} className="pt-2">
              <input type="hidden" name="orgSlug" value={orgSlug} />
              <input type="hidden" name="provider" value={provider} />
              <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label={`Delete ${provider} credentials`}>
                Delete
              </Button>
            </form>
          </div>
        ) : null}

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
            <Button type="submit" disabled={pending} aria-label={`Save ${provider} credentials`}>
              Save
            </Button>
          </div>
        </form>

        {masked.configured ? (
          <form action={handleTest}>
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="provider" value={provider} />
            <Button type="submit" variant="outline" size="sm" disabled={pending} aria-label={`Test ${provider} connection`}>
              Test connection
            </Button>
          </form>
        ) : null}

        {message ? (
          <p role="status" className={`text-sm ${isError ? "text-destructive" : "text-green-600"}`}>
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
        description="Client ID and Secret for app token. Used for streams, videos, tags and EventSub."
        masked={twitch}
        fields={[
          { name: "clientId", label: "Client ID", placeholder: "twitch client id" },
          { name: "clientSecret", label: "Client Secret", placeholder: "••••••••••", type: "password" },
        ]}
      />
      <ProviderCard
        orgSlug={orgSlug}
        provider="youtube"
        title="YouTube"
        description="API Key for Data API v3 (public channels, videos, search)."
        masked={youtube}
        fields={[{ name: "apiKey", label: "API Key", placeholder: "youtube api key", type: "password" }]}
      />
      <ProviderCard
        orgSlug={orgSlug}
        provider="kick"
        title="Kick"
        description="Client ID and Secret for Kick app token."
        masked={kick}
        fields={[
          { name: "clientId", label: "Client ID", placeholder: "kick client id" },
          { name: "clientSecret", label: "Client Secret", placeholder: "••••••••••", type: "password" },
        ]}
      />
    </div>
  );
}
