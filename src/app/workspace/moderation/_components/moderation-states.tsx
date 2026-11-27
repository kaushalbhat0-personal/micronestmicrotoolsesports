import Link from "next/link";
import { MODERATION_WORKSPACE_DISABLED_MESSAGE } from "../_lib/boundary";

export function ModerationDisabledNotice() {
  return (
    <div
      role="status"
      className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {MODERATION_WORKSPACE_DISABLED_MESSAGE}
    </div>
  );
}

export function ModerationSignInPrompt() {
  return (
    <p role="status" className="mt-6 text-sm text-slate-600">
      Sign in to access the moderation workspace.{" "}
      <Link href="/settings/profile" className="underline">
        Go to settings
      </Link>
    </p>
  );
}

export function ModerationQueueShell({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <p className="mt-3 text-sm text-slate-500">
        No queue rows are listed here: reviewer identity and report details stay
        private until an approved authorization boundary exists.
      </p>
    </div>
  );
}
