import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[80rem] px-5 py-6 md:px-6 md:py-8 lg:px-8 lg:py-10", className)}
      {...props}
    />
  );
}

export function Section({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("space-y-4", className)} {...props} />;
}
