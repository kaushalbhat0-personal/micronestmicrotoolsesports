import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container-nest flex h-14 items-center justify-between gap-4">
        <Logo height={28} priority />
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          <Link
            href="/tools"
            className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tools
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Pricing
          </Link>
          <Link
            href="/#tools"
            className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Overview
          </Link>
        </nav>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium hover:bg-muted min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] min-h-[44px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
