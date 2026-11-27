"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth/redirect";
import { validateEmail, validatePassword } from "@/lib/auth/validation";

const inputClass =
  "rounded-none border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600";
const labelClass = "text-sm font-medium";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const linkError = searchParams.get("error");
  const [error, setError] = useState<string | null>(
    linkError === "link-expired"
      ? "That link has expired or was already used. Sign in or request a new one."
      : null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.message);
      return;
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      setError(passwordCheck.message);
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      // Generic only — no email-confirmation workflow in the frictionless policy.
      setError("Could not sign in. Check your credentials and try again.");
      return;
    }

    startTransition(() => {
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} aria-label="Sign in" className="grid gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="login-email" className={labelClass}>
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="login-password" className={labelClass}>
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-accent-600 focus-visible:outline-accent-600 text-xs font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Forgot password?
          </Link>
        </div>
        <div className="flex gap-2">
          <input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={8}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="hover:bg-steel-100 focus-visible:outline-accent-600 inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-slate-300 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-accent-600 text-sm">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-accent-600 hover:bg-accent-700 focus-visible:outline-accent-600 inline-flex min-h-[44px] items-center justify-center px-4 py-2 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
