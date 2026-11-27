"use client";

import { useState } from "react";
import {
  downloadBlob,
  renderShareCardBlob,
  ShareRenderError,
  type ShareCardSpec,
} from "@/lib/share-kit";

type Status = "idle" | "loading" | "success" | "error";

export function ShareDownloadButton({
  spec,
  label = "Download PNG card",
  className,
}: {
  spec: ShareCardSpec | null;
  label?: string;
  className?: string | undefined;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const disabled = spec === null || status === "loading";

  async function onClick(): Promise<void> {
    if (spec === null) {
      return;
    }
    setStatus("loading");
    setMessage("Preparing image…");
    try {
      const blob = await renderShareCardBlob(spec);
      downloadBlob(blob, spec.filenameBase);
      setStatus("success");
      setMessage("PNG downloaded.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof ShareRenderError
          ? error.message
          : "Could not create the image. Try again.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void onClick();
        }}
        disabled={disabled}
        aria-busy={status === "loading"}
        className={
          className ??
          "inline-flex min-h-[44px] items-center rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:opacity-60"
        }
      >
        {status === "loading" ? "Preparing PNG…" : label}
      </button>
      {message !== null ? (
        <p
          role="status"
          aria-live="polite"
          className={
            status === "error"
              ? "text-xs font-medium text-accent-600"
              : "text-xs font-medium text-emerald-700"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
