"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { passwordSchema } from "@/lib/validation";
import { formatPlanPrice, getPurchaseGuide, periodLabel } from "@/lib/purchase/plan-guidance";

export interface SignupPlan {
  slug: string;
  name: string;
  amountMinor: number;
  currency: string;
  billingPeriod: string;
}

/** Resend cooldown in seconds — cosmetic abuse friction; Supabase rate-limits server-side. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Resend-confirmation action for the post-signup success state.
 * Messaging is deliberately neutral on failure so the UI never reveals
 * whether an address is registered or confirmed (no account oracle).
 */
function ResendConfirmation({ email }: { email: string }) {
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onResend() {
    if (sending || cooldown > 0) return;
    setSending(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({ type: "signup", email });
    } catch {
      // Neutral on purpose — see component docstring.
    } finally {
      setSending(false);
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  const disabled = sending || cooldown > 0;
  const label = sending ? "Sending…" : cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend confirmation email";

  return (
    <div className="mt-4 space-y-2">
      <Button variant="outline" className="w-full min-h-[44px]" disabled={disabled} loading={sending} aria-busy={sending} onClick={onResend}>
        {label}
      </Button>
      {sent ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          If your account is waiting for confirmation, a new email is on its way.
        </p>
      ) : null}
    </div>
  );
}

export function SignupForm({ plan }: { plan?: SignupPlan | null }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const guide = getPurchaseGuide(plan?.slug);
  const toolName = guide?.toolName ?? plan?.name ?? null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) {
      setError(pw.error.issues[0]?.message ?? "Invalid password");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <p className="text-sm">Check your email to confirm your account, then sign in.</p>
            <p className="text-sm text-muted-foreground">
              Confirmation emails usually arrive within a few minutes. If you don&apos;t see it, check your spam or junk folder.
            </p>
          </div>
          <ResendConfirmation email={email} />
          {plan && toolName ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Then continue with {toolName} — you&apos;ll choose a workspace and continue to payment.
            </p>
          ) : null}
          {plan ? (
            <Link
              href={`/login?plan=${plan.slug}`}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Continue to sign in
            </Link>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign up</CardTitle>
      </CardHeader>
      <CardContent>
        {plan && toolName ? (
          <div className="mb-4 rounded-[12px] border border-primary/20 bg-primary/5 p-4" role="status" aria-live="polite">
            <p className="text-sm font-medium">You&apos;re getting started with {toolName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPlanPrice(plan.amountMinor, plan.currency)} / {periodLabel(plan.billingPeriod)} · Manual renewal, no automatic charge.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">After you confirm your email and sign in, you&apos;ll choose a workspace and continue to payment.</p>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
