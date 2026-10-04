import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">M</span>
          MicroNest
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          <Link href="/tools" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground min-h-[44px] inline-flex items-center">
            Tools
          </Link>
          <Link href="/#tools" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground min-h-[44px] inline-flex items-center">
            Overview
          </Link>
        </nav>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium hover:bg-muted min-h-[44px]">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
