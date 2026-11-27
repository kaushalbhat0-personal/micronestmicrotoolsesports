"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { AVATAR_MAX_BYTES } from "@/features/player-profile/schemas/avatar";
import {
  removeAvatarAction,
  uploadAvatarAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

export function AvatarSection({
  avatarPublicUrl,
  hasAvatar,
}: {
  avatarPublicUrl: string | null;
  hasAvatar: boolean;
}) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadAvatarAction,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeAvatarAction,
    initialState,
  );
  const message = uploadState.message || removeState.message;
  const ok = uploadState.message ? uploadState.ok : removeState.ok;

  return (
    <section
      aria-labelledby="avatar-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="avatar-heading" className="text-lg font-semibold">
        Avatar
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Public portrait stored in the platform avatar bucket (PNG, JPEG, or WebP, max{" "}
        {Math.floor(AVATAR_MAX_BYTES / 1024)} KB). Not used for BGMI ownership evidence.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {avatarPublicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public storage URL; avoid next/image remote config coupling
          <img
            src={avatarPublicUrl}
            alt="Your current avatar"
            width={96}
            height={96}
            className="size-24 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <div
            className="flex size-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500"
            aria-hidden="true"
          >
            No avatar
          </div>
        )}
        <form action={uploadAction} className="flex min-w-[12rem] flex-1 flex-col gap-3">
          <label htmlFor="settings-avatar" className="text-sm font-medium">
            Upload image
          </label>
          <input
            id="settings-avatar"
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <Button type="submit" disabled={uploadPending}>
            {uploadPending ? "Uploading…" : "Upload avatar"}
          </Button>
        </form>
      </div>
      {hasAvatar ? (
        <form action={removeAction} className="mt-3">
          <Button type="submit" variant="secondary" disabled={removePending}>
            {removePending ? "Removing…" : "Remove avatar"}
          </Button>
        </form>
      ) : null}
      {message.length > 0 ? (
        <p
          role={ok ? "status" : "alert"}
          className={`mt-3 text-sm ${ok ? "text-emerald-800" : "text-accent-600"}`}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
