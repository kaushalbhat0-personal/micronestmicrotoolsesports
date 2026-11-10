import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-slate-500 sm:px-6">
        {siteConfig.name} — discovery and opportunity platform.
      </div>
    </footer>
  );
}
