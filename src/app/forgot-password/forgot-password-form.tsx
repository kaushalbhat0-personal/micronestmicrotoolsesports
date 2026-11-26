"use client";

// Password-recovery request (P14-D10).
// Uses the existing Supabase Auth recovery flow; the reset link returns to
// /auth/callback so the session is established server-side before the user
// sets a new password. If SMTP/recovery is not configured, Supabase returns
// an error which is shown generically (no enumeration).

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/auth/validation";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setMessage(null);
    const email = String(formData.get("email") ?? "").trim();
    const check = validateEmail(email);
    if (!check.ok) {
      setMessage({ ok: false, text: check.message });
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings/profile`,
      });
      if (error) {
        setMessage({
          ok: false,
          text: "Could not send a reset email. Please try again shortly.",
        });
        return;
      }
      // Generic success (no enumeration of registered addresses).
      setMessage({
        ok: true,
        text: "If an account exists for that email, a reset link is on its way. Check your inbox.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} aria-label="Forgot password" className="grid gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="recovery-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="text-ink-900 focus-visible:outline-accent-600 rounded-none border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1"
        />
      </div>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className="text-sm text-slate-700">
          {message.text}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent-600 hover:bg-accent-700 focus-visible:outline-accent-600 inline-flex min-h-[44px] items-center justify-center px-4 py-2 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
