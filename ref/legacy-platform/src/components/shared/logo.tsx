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
 * - Logo: full lockup (mark + wordmark + tagline) from /public/Final_MicroNest_Logo.svg
 *   Use only for footer/press/OG — not for compact navigation.
 * - LogoMark: mark-only from /public/micronest-mark.svg
 *   Use for header, hero, dashboard, auth, and any compact UI.
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

export function LogoMark({
  className,
  size = 32,
  priority = false,
  href,
}: {
  className?: string;
  size?: number;
  priority?: boolean;
  href?: string;
}) {
  const img = (
    <Image
      src="/micronest-mark.svg"
      alt="MicroNest"
      width={size}
      height={size}
      priority={priority}
      className={cn("select-none", className)}
      style={{ height: `${size}px`, width: `${size}px` }}
    />
  );

  if (typeof href === "string" && href.length > 0) {
    return (
      <Link href={href as never} className="inline-flex items-center shrink-0" aria-label="MicroNest home">
        {img}
      </Link>
    );
  }
  return img;
}
