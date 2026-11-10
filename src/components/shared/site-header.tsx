import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold">
          {siteConfig.name}
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">Discovery</span>
          <span className="text-slate-500">Opportunities</span>
        </nav>
      </div>
    </header>
  );
}
