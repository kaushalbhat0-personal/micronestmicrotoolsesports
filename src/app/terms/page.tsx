import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "MicroNest terms of service — use of Sponsorship Tracking and other micro-tools.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

          <div className="prose prose-neutral dark:prose-invert mt-8 max-w-none space-y-8 text-sm leading-6">
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance</h2>
              <p className="mt-2 text-muted-foreground">
                By accessing or using MicroNest Esports Micro-SaaS (“MicroNest”), including Sponsorship Tracking, you agree to these Terms. If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. What MicroNest provides</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest hosts independent micro-tools for esports organizations (for example, Sponsorship Tracking). Features are provided on an organization/workspace basis. No tool is
                intended to replace platform-native dashboards; they provide narrow, independently valuable verification and tracking.
              </p>
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
              <h2 className="text-lg font-semibold">7. Your content and data</h2>
              <p className="mt-2 text-muted-foreground">
                You retain ownership of content you provide. You grant MicroNest a limited license to process workspace content (campaign requirements, connected channel identifiers, and fetched
                public or authorized video/channel metadata) solely to provide the requested tool functionality (scans, evidence, proof, results).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Intellectual property</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest, its branding, and application code are protected. You may not copy, reverse-engineer, or redistribute the service except as permitted by law or by explicit
                permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Service availability</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest is provided on an as-is and as-available basis. We may update, limit, or discontinue features, and may apply rate limits or quotas to protect quality. No uptime
                commitment is made in this version except as separately agreed in writing.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Limitation of liability</h2>
              <p className="mt-2 text-muted-foreground">
                To the maximum extent permitted by law, MicroNest will not be liable for indirect, incidental, consequential, or loss-of-data damages arising from your use of the service.
                Where liability cannot be excluded, it will be limited to amounts paid for the service in the prior billing period, if any.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Termination</h2>
              <p className="mt-2 text-muted-foreground">
                You may stop using the service at any time. We may suspend or terminate access for violations of these Terms, security risks, or legal requirements. Upon termination, your
                ability to fetch new data stops; historical workspace data is handled according to normal retention, and you may request workspace removal via your administrator.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">12. Changes to these terms</h2>
              <p className="mt-2 text-muted-foreground">
                We may update these Terms and will post the new version with an updated “Last updated” date. Continued use after the update constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">13. Contact</h2>
              <p className="mt-2 text-muted-foreground">
                For questions about these Terms, contact the workspace owner or MicroNest administrator via the dashboard. The repository does not currently publish a dedicated legal contact;
                jurisdiction and entity information are intentionally omitted pending formal incorporation. Where a support email is later published, this section will be updated.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
