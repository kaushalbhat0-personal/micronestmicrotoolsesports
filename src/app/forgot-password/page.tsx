import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a MicroNest Esports password reset link.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
      <p className="text-accent-600 text-xs font-bold tracking-[0.18em] uppercase">
        Account recovery
      </p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight uppercase sm:text-4xl">
        Forgot password
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Enter your account email and we will send a reset link if an account exists.
      </p>
      <div className="mt-6 border border-slate-200 bg-white p-4 sm:p-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        <Link
          href="/login"
          className="text-accent-600 focus-visible:outline-accent-600 font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
