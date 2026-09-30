import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">M</span>
          MicroNest
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium hover:bg-muted">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
