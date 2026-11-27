import { MarketingCTA } from "@/components/marketing/cta-button";
import { MarketingSection } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { SpecimenCard } from "./specimen-card";

export function PlayerIdentitySection() {
  return (
    <MarketingSection
      id="identity"
      tone="steel"
      eyebrow="Your player identity"
      title="A shareable FRAGIX card — ready when you are"
      lede="Download and share your player PNG from your public profile anytime. Ownership review is optional for sharing — it unlocks registry discoverability when approved."
    >
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="flex justify-center lg:justify-start">
          <SpecimenCard />
        </div>
        <div className="min-w-0">
          <ul className="divide-y divide-ink-900/10 border-y-2 border-ink-900">
            {[
              {
                title: "Create immediately",
                copy: "Sign up, finish your profile, and your public URL is ready.",
              },
              {
                title: "Share without review",
                copy: "PNG download does not wait on BGMI ownership approval.",
              },
              {
                title: "Badge when approved",
                copy: "The ownership-reviewed mark appears only while approval stays valid.",
              },
            ].map((item) => (
              <li key={item.title} className="py-4">
                <h3 className="font-display text-lg font-extrabold tracking-tight uppercase">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">{item.copy}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 max-w-xs">
            <MarketingCTA href="/signup">Create your player card</MarketingCTA>
          </div>
          <p className="mt-3 text-xs text-ink-600">
            After signup you continue into profile setup — the default {siteConfig.name} onboarding
            path.
          </p>
        </div>
      </div>
    </MarketingSection>
  );
}
