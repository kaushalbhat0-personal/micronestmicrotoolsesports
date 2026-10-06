import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "@/styles/globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MicroNest — Focused Tools for the Business of Esports",
    template: "%s | MicroNest",
  },
  description:
    "Sponsorships. Scrims. Prizes. Content. Rosters. MicroNest is a subscription software platform providing focused tools for the business of esports — customers subscribe for digital access per workspace.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  verification: {
    google: "Gl_7do3C6Uefr-BDyM411YJZpfo2D4vv1tG1PYaDvuo",
  },
  icons: {
    icon: [{ url: "/micronest-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/micronest-mark.svg", type: "image/svg+xml" }],
    shortcut: "/micronest-mark.svg",
  },
  openGraph: {
    type: "website",
    siteName: "MicroNest",
    locale: "en_US",
    images: [{ url: "/Final_MicroNest_Logo.svg", width: 1200, height: 630, alt: "MicroNest — The toolbox behind esports" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/Final_MicroNest_Logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
