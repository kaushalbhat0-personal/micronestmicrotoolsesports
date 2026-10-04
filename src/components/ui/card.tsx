import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type CardVariant = "default" | "elevated" | "muted" | "ghost" | "hero";

const variantClasses: Record<CardVariant, string> = {
  default: "rounded-[16px] border bg-card text-card-foreground",
  elevated: "rounded-[16px] border bg-card text-card-foreground shadow-sm",
  muted: "rounded-[16px] border bg-surface-muted text-card-foreground",
  ghost: "rounded-[16px] border-transparent bg-transparent",
  hero: "rounded-[20px] border bg-card text-card-foreground shadow-sm",
};

export function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div className={cn(variantClasses[variant], className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[15px] font-semibold leading-none tracking-[-0.01em]", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
