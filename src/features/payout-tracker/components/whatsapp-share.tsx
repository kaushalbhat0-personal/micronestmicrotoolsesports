"use client";

import * as React from "react";
import { WhatsAppShare } from "@/components/shared/whatsapp-share";
import { buildPayoutWhatsAppMessage } from "../services/whatsapp";

/**
 * Prize Payout Tracker — WhatsApp sharing for published/completed
 * records. Rendered only when the public page is live (callers gate on
 * published/completed + share token). The message is a short
 * announcement — event name, record status, and the existing public URL
 * only. Recipient rows, amounts, references, and proof links never enter
 * the message. The editor note is user-supplied text, never auto-filled
 * from private fields.
 */
export function PayoutWhatsAppShare({
  eventName,
  status,
  shareToken,
}: {
  eventName: string;
  status: "published" | "completed";
  shareToken: string;
}) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!origin) return null;
  const message = buildPayoutWhatsAppMessage({
    eventName,
    status,
    publicUrl: `${origin}/share/payout/${shareToken}`,
  });
  return (
    <WhatsAppShare
      message={message}
      reviewNote="Shares a short announcement with the public payout link — recipient names and amounts stay in the linked record, never in the message."
    />
  );
}
