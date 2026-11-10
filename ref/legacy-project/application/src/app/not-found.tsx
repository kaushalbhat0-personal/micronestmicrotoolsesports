import Link from "next/link";
import { LogoMark } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <LogoMark size={40} href="/" />
      <h1 className="font-display mt-6 text-4xl font-normal tracking-tight">404</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The page you’re looking for doesn’t exist. Back to the workbench.</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Back to home
      </Link>
    </div>
  );
}
