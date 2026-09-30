export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} MicroNest — Esports micro-SaaS platform. All rights reserved.
      </div>
    </footer>
  );
}
