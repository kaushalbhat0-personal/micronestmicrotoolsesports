"use client";

import * as React from "react";
import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { requestScanAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import { Button } from "@/components/ui/button";

export function CheckNowButton({
  orgSlug,
  campaignId,
  size = "sm",
  variant = "default",
}: {
  orgSlug: string;
  campaignId: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bounded polling: refresh every 3s for ~15s after starting
  function startPolling() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    let ticks = 0;
    intervalRef.current = setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= 5) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 3000);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setPending(false);
    }, 15000);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleClick() {
    if (pending) return;
    setError(null);
    setPending(true);
    const fd = new FormData();
    fd.set("orgSlug", orgSlug);
    fd.set("campaignId", campaignId);
    try {
      const result = await requestScanAction(fd);
      // If server returned validation error synchronously
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError(result.error);
        setPending(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }
      // Success: background check scheduled, start polling for real result
      startTransition(() => {
        router.refresh();
      });
      startPolling();
      // Keep pending visually for at least a few seconds; polling timeout will clear
    } catch (e) {
      const msg = e instanceof Error ? e.message : "We couldn't complete this check. Please try again in a moment.";
      if (msg.includes("NEXT_REDIRECT")) throw e;
      // Never expose internal details
      const safe = msg.includes("NEXT_REDIRECT") ? "We couldn't complete this check. Please try again in a moment." : msg;
      // Map technical to customer-facing if needed
      const isTechnical = safe.includes("organization") || safe.includes("campaign") || safe.includes("provider") || safe.includes("API");
      setError(isTechnical ? "We couldn't complete this check. Please try again in a moment." : safe);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleClick}
        disabled={pending}
        aria-label={pending ? "Checking" : "Check now"}
        aria-busy={pending}
        loading={pending}
        className="min-h-[44px]"
      >
        {pending ? "Checking…" : "Check now"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {pending ? <p className="text-xs text-muted-foreground">We are checking this creator channel now.</p> : null}
    </div>
  );
}
