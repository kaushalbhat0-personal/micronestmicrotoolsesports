export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground sm:px-6 sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} MicroNest — Esports micro-SaaS platform. All rights reserved.</span>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <a href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
            Privacy Policy
          </a>
          <a href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
            Terms of Service
          </a>
        </nav>
      </div>
    </footer>
  );
}
