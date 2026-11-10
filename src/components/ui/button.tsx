import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium",
        variant === "primary" && "bg-slate-900 text-white",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-900",
        className
      )}
      {...props}
    />
  );
}
