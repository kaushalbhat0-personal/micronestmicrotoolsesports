import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface LogoProps {
  className?: string;
  height?: number;
  priority?: boolean;
  href?: string;
}

/**
 * MicroNest Logo — single source of truth
 * Asset: /public/Final_MicroNest_Logo.svg — DO NOT modify source
 * Use CSS sizing (height) with w-auto to preserve aspect ratio (viewBox 0 0 1500 1500)
 */
export function Logo({ className, height = 28, priority = false, href = "/" }: LogoProps) {
  const isLinked = typeof href === "string" && href.length > 0;
  const img = (
    <Image
      src="/Final_MicroNest_Logo.svg"
      alt="MicroNest"
      width={Math.round(height * 1.8)}
      height={height}
      priority={priority}
      className={cn("w-auto select-none", className)}
      style={{ height: `${height}px`, width: "auto" }}
    />
  );

  if (isLinked) {
    return (
      <Link href={href as never} className="inline-flex items-center shrink-0" aria-label="MicroNest home">
        {img}
      </Link>
    );
  }
  return img;
}

export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/Final_MicroNest_Logo.svg"
      alt="MicroNest"
      width={Math.round(size * 1.8)}
      height={size}
      className={cn("w-auto select-none", className)}
      style={{ height: `${size}px`, width: "auto" }}
    />
  );
}
