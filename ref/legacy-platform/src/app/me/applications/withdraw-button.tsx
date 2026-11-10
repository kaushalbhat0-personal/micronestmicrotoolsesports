"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { withdrawApplicationAction } from "./actions";

/** Withdraw button for an active (applied/shortlisted) application. */
export function WithdrawButton({ applicationId }: { applicationId: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onWithdraw() {
    setPending(true);
    setResult(null);
    const outcome = await withdrawApplicationAction(applicationId);
    setResult(outcome);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onWithdraw}
      >
        Withdraw
      </Button>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "text-xs text-green-600" : "text-xs text-red-600"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
