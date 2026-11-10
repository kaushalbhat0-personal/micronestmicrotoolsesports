"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/shared/logo";
import { marketingNav } from "@/config/navigation";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function Header() {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container-nest flex h-14 items-center justify-between gap-4">
        <LogoMark size={32} priority href="/" className="!size-7 sm:!size-8" />
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Home
          </Link>
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className="inline-flex min-h-[44px] items-center rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="hidden h-9 min-h-[44px] items-center rounded-full px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 min-h-[44px] items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Get started
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={open}
                className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent aria-label="Site menu">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 p-4">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center rounded-[12px] px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Home
                </Link>
                {marketingNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as never}
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-[44px] items-center rounded-[12px] px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/tools"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center rounded-[12px] px-3 text-sm font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  All tools directory
                </Link>
                <div className="mt-2 flex gap-2 border-t border-border pt-4">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border px-4 text-sm font-medium"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    Get started
                  </Link>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}
