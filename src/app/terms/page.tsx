import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Terms of Service — MicroNest",
  description: "MicroNest MicroTools — Esports terms of service. Support: info.micronest@gmail.com. Location: Pune, Maharashtra, India. Governing jurisdiction: India.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-normal tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

          <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance</h2>
              <p className="mt-2 text-muted-foreground">
                By accessing or using MicroNest Esports Micro-SaaS (“MicroNest”), including Sponsorship Tracking, you agree to these Terms. If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. What MicroNest provides</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest (“MicroNest MicroTools — Esports”) is a subscription software platform that provides focused workflow tools for esports teams, organizations, creators, and tournament operators. MicroNest hosts independent micro-tools for esports organizations (for example, Sponsorship Tracking). Features are provided on an organization/workspace basis. No tool is intended to replace platform-native dashboards; they provide narrow, independently valuable verification and tracking.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Brand: MicroNest · Product: MicroNest MicroTools — Esports · Operating location: Pune, Maharashtra, India · Support: <a href="mailto:info.micronest@gmail.com" className="underline underline-offset-4 hover:text-foreground">info.micronest@gmail.com</a> · MicroNest is currently not registered for GST.</p>
              <div className="mt-4 space-y-3 rounded-[12px] border border-border bg-surface-muted/30 p-4">
                <h3 className="text-sm font-semibold">Service type — digital software</h3>
                <p className="text-sm text-muted-foreground">
                  MicroNest provides digital software services. Purchases grant subscription access to the selected tool or bundled All Access within your organization/workspace. No physical products are shipped.
                </p>
                <h3 className="text-sm font-semibold">Subscription — monthly and yearly</h3>
                <p className="text-sm text-muted-foreground">
                  Plans are billed per the selected period — monthly or yearly — in INR as displayed at checkout. Subscriptions provide access for the purchased period (shown as “Active until” in Settings → Billing). Renewal requires a new purchase before or after expiry; access remains until the current period’s expiry and does not auto-extend without payment. There is no automatic recurring charge, no AutoPay, and no recurring mandate.
                </p>
                <h3 className="text-sm font-semibold">Digital delivery</h3>
                <p className="text-sm text-muted-foreground">
                  No physical shipping occurs. Software access is provisioned digitally to your organization/workspace immediately after payment verification (Razorpay → webhook → entitlement). You can confirm access in Dashboard → Settings → Billing.
                </p>
                <h3 className="text-sm font-semibold">Refunds</h3>
                <p className="text-sm text-muted-foreground">
                  No refunds after purchase and digital access provisioning. See <a href="/refund" className="underline underline-offset-4 hover:text-foreground">Refund &amp; Cancellation Policy</a>. Legitimate duplicate or erroneous payment issues can be reported to <a href="mailto:info.micronest@gmail.com" className="underline underline-offset-4 hover:text-foreground">info.micronest@gmail.com</a> for investigation — this does not create an automatic refund entitlement.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Accounts and eligibility</h2>
              <p className="mt-2 text-muted-foreground">
                You must provide an accurate email and keep your credentials secure. You are responsible for all activity under your account. MicroNest is not intended for use by children.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Workspaces and organizations</h2>
              <p className="mt-2 text-muted-foreground">
                Organizations contain campaigns, channels, scans, evidence, and integrations. Membership and entitlements control access. Only members of an organization may view or manage its
                data, enforced by workspace isolation in the product.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Acceptable use</h2>
              <p className="mt-2 text-muted-foreground">You agree not to:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>violate applicable laws or platform terms (Twitch, YouTube, Kick) when connecting creator channels;</li>
                <li>attempt to access data of organizations you are not a member of;</li>
                <li>abuse rate limits, quotas, or attempt to bypass YouTube Data API quotas; </li>
                <li>upload malicious content or interfere with the service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Third-party integrations</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest connects to third-party platforms (YouTube, Twitch, Kick, and others) via their public APIs or OAuth where you have explicitly connected an account. Each integration is
                subject to that platform’s terms:
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>YouTube features use the YouTube Data API v3 and `youtube.readonly` OAuth where connected;</li>
                <li>Twitch features use Helix API;</li>
                <li>Kick features use the Kick Public API.</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                MicroNest’s ability to fetch channel or video data depends on those platforms remaining available and on you maintaining a valid connection (including valid OAuth
                authorization where applicable). We do not control third-party availability, quotas, or approval.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Tool boundaries — what MicroNest does not do</h2>
              <div className="mt-3 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Prize Pool Splitter — calculation only</h3>
                  <p className="mt-1 text-muted-foreground">
                    Prize Pool Splitter is subscription software that helps you calculate and organize prize-pool distributions in your workspace. MicroNest does not hold, escrow, transfer, or distribute tournament prize money, and does not operate tournaments or guarantee winnings. You remain responsible for actually distributing funds to participants.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Sponsorship Tracking — verification only</h3>
                  <p className="mt-1 text-muted-foreground">
                    Sponsorship Tracking is subscription software that helps you verify sponsor deliverables and keep proof-of-performance organized. MicroNest does not broker sponsorship deals, sell sponsorships, represent teams or sponsors, or guarantee sponsorship revenue. You manage your sponsor relationships; we provide the tracking tools.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Your content and data</h2>
              <p className="mt-2 text-muted-foreground">
                You retain ownership of content you provide. You grant MicroNest a limited license to process workspace content (campaign requirements, connected channel identifiers, and fetched
                public or authorized video/channel metadata) solely to provide the requested tool functionality (scans, evidence, proof, results).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Intellectual property</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest, its branding, and application code are protected. You may not copy, reverse-engineer, or redistribute the service except as permitted by law or by explicit
                permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Service availability</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest is provided on an as-is and as-available basis. We may update, limit, or discontinue features, and may apply rate limits or quotas to protect quality. No uptime
                commitment is made in this version except as separately agreed in writing.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Limitation of liability</h2>
              <p className="mt-2 text-muted-foreground">
                To the maximum extent permitted by law, MicroNest will not be liable for indirect, incidental, consequential, or loss-of-data damages arising from your use of the service.
                Where liability cannot be excluded, it will be limited to amounts paid for the service in the prior billing period, if any.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">12. Termination</h2>
              <p className="mt-2 text-muted-foreground">
                You may stop using the service at any time. We may suspend or terminate access for violations of these Terms, security risks, or legal requirements. Upon termination, your
                ability to fetch new data stops; historical workspace data is handled according to normal retention, and you may request workspace removal via your administrator.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">13. Changes to these terms</h2>
              <p className="mt-2 text-muted-foreground">
                We may update these Terms and will post the new version with an updated “Last updated” date. Continued use after the update constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">14. Governing law &amp; jurisdiction</h2>
              <p className="mt-2 text-muted-foreground">These Terms are governed by the laws of India.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">15. Contact</h2>
              <p className="mt-2 text-muted-foreground">
                For questions about these Terms, billing, payments, or service issues, contact <a href="mailto:info.micronest@gmail.com" className="underline underline-offset-4 hover:text-foreground">info.micronest@gmail.com</a>. Workspace members may also contact their workspace owner or check Dashboard → Settings → Billing for current access. Do not send passwords, OAuth secrets, Razorpay signatures, or payment credentials by email. Operating location: Pune, Maharashtra, India.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">MicroNest Services is the planned parent business and is not represented as an already registered entity. No CIN, GSTIN, or registration number is claimed.</p>
            </section>
          </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
