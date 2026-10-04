"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <ErrorState
        title="Something went wrong"
        message={error.message || "An unexpected error occurred. Please try again."}
        retry={reset}
      />
      <div className="mt-6 flex justify-center">
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}
