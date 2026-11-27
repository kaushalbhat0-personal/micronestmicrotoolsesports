"use client";

import * as React from "react";
import { WhatsAppShare } from "@/components/shared/whatsapp-share";
import { buildTieBreakerWhatsAppMessage } from "../services/whatsapp";
import type { TieBreakerCopyRecord } from "../services/share-text";

/**
 * Tie-Breaker Resolver — WhatsApp sharing for locked/official records.
 * Rendered only for locked competitions (callers gate on status). The
 * message is composed client-side from the locked record plus its
 * existing public token URL; the official record itself is never
 * modified — the editor changes only the outgoing message.
 */
export function TieBreakerWhatsAppShare({
  record,
  shareToken,
}: {
  record: TieBreakerCopyRecord;
  shareToken: string;
}) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!origin) return null;
  const message = buildTieBreakerWhatsAppMessage(record, `${origin}/share/tie-breaker/${shareToken}`);
  return (
    <WhatsAppShare
      message={message}
      reviewNote="Official locked result — the record itself cannot change. You are only editing the message you're about to send."
    />
  );
}
