import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "platform-youtube"
  | "platform-twitch"
  | "platform-kick";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground border border-transparent",
  secondary: "bg-secondary text-secondary-foreground border border-transparent",
  destructive: "bg-destructive text-destructive-foreground border border-transparent",
  outline: "border border-border text-foreground bg-card",
  success: "bg-success text-success-foreground border border-transparent",
  warning: "bg-warning text-warning-foreground border border-transparent",
  info: "bg-info text-info-foreground border border-transparent",
  "platform-youtube": "bg-[hsl(0_72%_51%)] text-white border border-transparent",
  "platform-twitch": "bg-[hsl(264_35%_48%)] text-white border border-transparent",
  "platform-kick": "bg-[hsl(142_40%_42%)] text-white border border-transparent",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-none transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
