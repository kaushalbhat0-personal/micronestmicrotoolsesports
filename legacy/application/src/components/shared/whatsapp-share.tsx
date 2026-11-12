"use client";

import * as React from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppShareUrl } from "@/lib/share/whatsapp";

/**
 * WhatsAppShare — lightweight share-on-WhatsApp affordance.
 *
 * Flow: collapsed "Share on WhatsApp" button → inline editor prefilled
 * with the ready-made `message` → user reviews/edits → "Open WhatsApp"
 * anchor opens the official wa.me click-to-chat URL (message pre-filled,
 * recipient chosen by the user, Send pressed by the user).
 *
 * Fully client-side: no network calls, no server actions, no storage,
 * no tracking, no phone numbers. The message is caller-supplied text that
 * never leaves the browser except inside the wa.me URL the user opens.
 */
export function WhatsAppShare({
  message,
  reviewNote,
  shareLabel = "Share on WhatsApp",
  editorLabel = "Message to share on WhatsApp",
  className,
}: {
  /** Ready-made message built from the actual tool result. */
  message: string;
  /** Optional privacy/review guidance shown above the editor. */
  reviewNote?: string | undefined;
  /** Toggle button text. Defaults to "Share on WhatsApp". */
  shareLabel?: string | undefined;
  /** Accessible label for the message editor. */
  editorLabel?: string | undefined;
  className?: string | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(message);
  const editorRef = React.useRef<HTMLTextAreaElement>(null);

  // Refresh the draft whenever the panel opens so it always starts from
  // the latest ready-made message, then move focus into the editor.
  React.useEffect(() => {
    if (open) {
      setDraft(message);
      editorRef.current?.focus();
    }
  }, [open, message]);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`min-h-[44px] ${className ?? ""}`}
        aria-expanded={false}
        aria-label={shareLabel}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        {shareLabel}
      </Button>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {reviewNote ? <p className="text-xs text-muted-foreground">{reviewNote}</p> : null}
      <label htmlFor="whatsapp-share-editor" className="text-xs font-medium text-foreground">
        {editorLabel}
      </label>
      <textarea
        id="whatsapp-share-editor"
        ref={editorRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        className="max-h-[240px] min-h-[120px] w-full overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-border bg-surface-muted/40 p-3 font-mono text-[13px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap gap-2">
        <a
          href={buildWhatsAppShareUrl(draft)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open WhatsApp with this message prefilled"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Open WhatsApp
        </a>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="min-h-[44px]" aria-label="Close WhatsApp sharing">
          Close
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">WhatsApp opens with the message prefilled — you choose who receives it and press Send.</p>
    </div>
  );
}
