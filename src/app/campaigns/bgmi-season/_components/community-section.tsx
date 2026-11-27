import Link from "next/link";
import type { Route } from "next";
import { MarketingSection } from "@/components/marketing/section";

const lanes: Array<{
  href: Route;
  title: string;
  body: string;
  action: string;
}> = [
  {
    href: "/players",
    title: "Player registry",
    body: "Browse ownership-reviewed, opted-in public profiles. Private BGMI IDs and evidence never appear here.",
    action: "Explore players",
  },
  {
    href: "/teams",
    title: "Team discovery",
    body: "Find public teams and recruitment status from declared fields only — no invented roster identities.",
    action: "Explore teams",
  },
];

export function CommunitySection() {
  return (
    <MarketingSection
      id="community"
      tone="steel"
      eyebrow="Competitive community"
      title="Discover who is already out there"
      lede="Real FRAGIX discovery routes. Listings come from authorized public projections — never fabricated counts or private data."
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {lanes.map((lane) => (
          <li key={lane.href} className="flex flex-col border border-steel-200 bg-paper p-5">
            <h3 className="font-display text-xl font-extrabold tracking-tight uppercase">
              {lane.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{lane.body}</p>
            <Link
              href={lane.href}
              className="bg-accent-600 hover:bg-accent-700 mt-5 inline-flex min-h-[44px] items-center justify-center px-4 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              {lane.action}
            </Link>
          </li>
        ))}
      </ul>
    </MarketingSection>
  );
}
