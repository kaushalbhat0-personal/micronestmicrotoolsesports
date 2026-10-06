"use client";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/shared/logo";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <LogoMark size={40} />
      <h1 className="font-display mt-6 text-2xl font-normal tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <Button className="mt-6" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
