"use client";

// Registration form (P14-D12). Email/password only — no OAuth, no email
// confirmation workflow. Immediate session required; missing session means
// Auth config is misaligned (show generic failure, never a verify-email UI).

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeSignupNextPath } from "@/lib/auth/redirect";
import {
  PASSWORD_REQUIREMENTS_COPY,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";

const inputClass =
  "rounded-none border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600";
const labelClass = "text-sm font-medium";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeSignupNextPath(searchParams.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);

    const displayName = String(formData.get("display_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm_password") ?? "");

    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.ok) {
      setError(nameCheck.message);
      return;
    }
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
    if (password !== confirm) {
      setError("Passwords do not match. Re-enter both fields.");
      return;
    }

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (signUpError) {
      const message = signUpError.message.toLowerCase();
      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists")
      ) {
        setError("This email is already registered. Try logging in instead.");
      } else if (message.includes("password")) {
        setError("Password does not meet requirements. Use at least 8 characters.");
      } else {
        setError("Could not create your account. Please try again.");
      }
      return;
    }

    // Frictionless policy: confirmation is disabled. No session means remote
    // Auth is not aligned — never show a confirmation-pending workflow.
    if (!data.session) {
      setError(
        "Account created but sign-in did not complete. Try logging in, or contact support if this continues.",
      );
      return;
    }

    startTransition(() => {
      router.replace(nextPath);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} aria-label="Sign up" className="grid gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-name" className={labelClass}>
          Display name
        </label>
        <input
          id="signup-name"
          name="display_name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Nova Captain"
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-email" className={labelClass}>
          Email
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password" className={labelClass}>
          Password
        </label>
        <div className="flex gap-2">
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            className={`${inputClass} min-w-0 flex-1`}
            aria-describedby="password-requirements"
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
        <ul id="password-requirements" className="mt-1 list-disc pl-5 text-xs text-slate-500">
          {PASSWORD_REQUIREMENTS_COPY.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="signup-confirm" className={labelClass}>
          Confirm password
        </label>
        <div className="flex gap-2">
          <input
            id="signup-confirm"
            name="confirm_password"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-pressed={showConfirm}
            aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}
            className="hover:bg-steel-100 focus-visible:outline-accent-600 inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-slate-300 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {showConfirm ? "Hide" : "Show"}
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
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
