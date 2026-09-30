import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function ErrorState({
  className,
  title = "Something went wrong",
  message,
  retry,
}: {
  className?: string;
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center", className)}
      role="alert"
    >
      <AlertTriangle className="mb-3 h-8 w-8 text-destructive" aria-hidden />
      <h3 className="font-semibold text-destructive">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>}
      {retry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
