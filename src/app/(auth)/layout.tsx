import type { Metadata } from "next";
import { LogoMark } from "@/components/shared/logo";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center border-b border-border bg-card px-4">
        <LogoMark size={28} priority href="/" />
      </header>
      <div className="flex flex-1 items-center justify-center bg-surface-muted/30 p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">The toolbox behind esports</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
