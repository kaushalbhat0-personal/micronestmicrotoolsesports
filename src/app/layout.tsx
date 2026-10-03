import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "MicroNest — Esports Micro-SaaS",
    template: "%s | MicroNest",
  },
  description: "Narrow, independently valuable microtools for esports organizations.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  verification: {
    google: "Gl_7do3C6Uefr-BDyM411YJZpfo2D4vv1tG1PYaDvuo",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
