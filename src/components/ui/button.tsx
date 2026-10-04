import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-[hsl(24_90%_48%)] active:bg-[hsl(24_88%_45%)] shadow-sm border border-transparent",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-[hsl(8_75%_52%)] border border-transparent shadow-sm",
  outline: "border border-border bg-card text-foreground hover:bg-muted hover:border-border-strong",
  secondary: "bg-secondary text-secondary-foreground hover:bg-accent border border-transparent",
  ghost: "text-foreground hover:bg-muted",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 rounded-full px-6 text-[14px]",
  sm: "h-9 rounded-full px-4 text-[13px]",
  lg: "h-12 rounded-full px-8 text-[14px]",
  icon: "h-11 w-11 rounded-full",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-[180ms]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
