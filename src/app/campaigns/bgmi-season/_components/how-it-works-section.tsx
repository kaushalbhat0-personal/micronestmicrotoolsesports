import { MarketingSection } from "@/components/marketing/section";

const steps = [
  {
    n: "01",
    title: "Create your player profile",
    copy: "Register, set your handle and BGMI game identity. No ownership review required to start.",
  },
  {
    n: "02",
    title: "Share your FRAGIX identity card",
    copy: "Download the PNG from your public profile and share the URL. Sharing stays available without verification.",
  },
  {
    n: "03",
    title: "Get BGMI ownership reviewed",
    copy: "Submit private evidence for manual review. Approval plus opt-in completeness unlocks registry discoverability — separate from registration and sharing.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <MarketingSection
      id="how"
      eyebrow="How FRAGIX works"
      title="Three steps. Clear boundaries."
      lede="Ownership review is not registration. It is not required to download your card."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.n}
            className="border border-steel-200 bg-paper p-5"
          >
            <p className="font-display text-accent-600 text-2xl font-extrabold">{step.n}</p>
            <h3 className="font-display mt-3 text-lg font-extrabold tracking-tight uppercase">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.copy}</p>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}
