import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Privacy Policy — MicroNest",
  description: "MicroNest MicroTools — Esports privacy policy. Contact: info.micronest@gmail.com, Pune, Maharashtra, India. How we handle your YouTube connection and workspace data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-normal tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

          <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
            <section>
              <h2 className="text-lg font-semibold">1. Overview</h2>
              <p className="mt-2 text-muted-foreground">
                MicroNest Esports Micro-SaaS (“MicroNest”) hosts independent micro-tools for esports organizations, including Sponsorship Tracking. This policy
                describes how MicroNest handles data when you connect a YouTube account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. YouTube connection — permission requested</h2>
              <p className="mt-2 text-muted-foreground">
                When you click <strong className="font-medium text-foreground">Connect YouTube</strong> in MicroNest, the application redirects to Google via
                <code className="rounded bg-muted px-1 py-0.5">https://accounts.google.com/o/oauth2/v2/auth</code> and requests a single scope:
              </p>
              <p className="mt-3">
                <code className="rounded bg-muted px-2 py-1 text-xs break-all">https://www.googleapis.com/auth/youtube.readonly</code>
              </p>
              <p className="mt-3 text-muted-foreground">
                This scope is labeled by Google as “View your YouTube account.” It grants <strong className="font-medium text-foreground">read-only</strong> access via OAuth 2.1 Authorization Code with PKCE
                (S256) and state protection. MicroNest requests <code className="rounded bg-muted px-1 py-0.5">access_type=offline</code> and{" "}
                <code className="rounded bg-muted px-1 py-0.5">prompt=consent</code> only to obtain a refresh token that keeps the read-only connection alive.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. YouTube data we may read</h2>
              <p className="mt-2 text-muted-foreground">Only when you have connected YouTube, MicroNest may read the following via the YouTube Data API v3 over HTTPS:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>Channel identity: channel ID (<code className="rounded bg-muted px-1 py-0.5">UC…</code>), channel title, and custom URL when available — obtained via <code className="rounded bg-muted px-1 py-0.5">channels.list?part=snippet&amp;mine=true</code>.</li>
                <li>Video discovery: video IDs for your channel via <code className="rounded bg-muted px-1 py-0.5">search.list</code> (limited to your channel, up to 25 recent candidates).</li>
                <li>Video metadata per video via <code className="rounded bg-muted px-1 py-0.5">videos.list?part=snippet,contentDetails,liveStreamingDetails</code>:</li>
                <li className="ml-4 list-none">
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>video ID, title, description, tags, category ID, published date, channel ID</li>
                    <li>duration (<code className="rounded bg-muted px-1 py-0.5">contentDetails.duration</code>)</li>
                    <li>live broadcast metadata when present (<code className="rounded bg-muted px-1 py-0.5">liveBroadcastContent</code>, <code className="rounded bg-muted px-1 py-0.5">liveStreamingDetails</code>)</li>
                  </ul>
                </li>
                <li>Category titles via <code className="rounded bg-muted px-1 py-0.5">videoCategories.list</code> when needed.</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                We do not request or use broader scopes such as <code className="rounded bg-muted px-1 py-0.5">youtube</code> or{" "}
                <code className="rounded bg-muted px-1 py-0.5">youtube.force-ssl</code>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Why we read it — purpose</h2>
              <p className="mt-2 text-muted-foreground">
                Sponsorship Tracking verifies creator deliverables: sponsor text in titles, sponsor links or hashtags in descriptions, category, duration, and campaign timing. The video/channel
                metadata above is fetched to build Proof and Result for each Check (scan → discovery → videos.list → normalization → evidence → evaluation). No other purpose is
                intended for YouTube data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. What we do not do — read-only</h2>
              <p className="mt-2 text-muted-foreground">MicroNest does not, via the YouTube integration:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>upload videos</li>
                <li>edit videos, titles, descriptions, or metadata</li>
                <li>delete videos</li>
                <li>edit or delete comments</li>
                <li>manage your YouTube account, subscriptions, or playlists beyond reading the metadata above</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. How your YouTube connection is protected</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>
                  YouTube connection details are <strong className="font-medium text-foreground">encrypted</strong> before they are stored. They belong to your
                  workspace only.
                </li>
                <li>Connection details are never shown in web addresses, are not written to logs, and travel only over secure HTTPS to Google.</li>
                <li>
                  Refresh happens securely on our servers; old details are kept only when Google does not rotate them.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Where YouTube-related data is stored</h2>
              <p className="mt-2 text-muted-foreground">When YouTube is connected, the following may be stored in your workspace:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>Connected creator channel information (YouTube channel ID, handle/custom URL, display name, `youtube.com/channel/UC…` URL).</li>
                <li>Sponsorship checks (scans), discovered video evidence (title/description/category/duration subset), and evaluations/results derived for that scan.</li>
              </ul>
              <p className="mt-3 text-muted-foreground">
                Evidence and evaluations are kept separate for each workspace and campaign. They are not shared across workspaces. No retention period is currently enforced beyond normal check history;
                disconnecting YouTube does not retroactively delete historical check evidence, which remains unless the workspace is removed.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. How to disconnect or revoke</h2>
              <p className="mt-2 text-muted-foreground">You can stop MicroNest from reading your YouTube data at any time:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                <li>
                  In MicroNest: go to <strong className="font-medium text-foreground">Dashboard → Settings → Integrations</strong> → Remove connection for YouTube. This clears your saved
                  connection in your workspace.
                </li>
                <li>
                  In Google: revoke MicroNest’s access at{" "}
                  <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                    myaccount.google.com/permissions
                  </a>{" "}
                  → find MicroNest → Remove access. Revocation immediately invalidates tokens; subsequent checks will require reconnecting.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Third-party disclosure</h2>
              <p className="mt-2 text-muted-foreground">
                YouTube data is fetched directly from YouTube and is not sold or shared with third parties. Aggregated proof/result is shown only inside your workspace to
                members of that workspace.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contact</h2>
              <p className="mt-2 text-muted-foreground">
                For privacy questions, contact <a href="mailto:info.micronest@gmail.com" className="underline underline-offset-4 hover:text-foreground">info.micronest@gmail.com</a>. Workspace members may also contact their workspace owner or MicroNest administrator via the dashboard. Operating location: Pune, Maharashtra, India. MicroNest is currently not registered for GST. Do not submit passwords, payment details, or connection secrets via email or chat.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Brand: MicroNest · Product: MicroNest MicroTools — Esports. Do not send passwords or payment signatures by email.</p>
            </section>

            <p className="mt-10 border-t pt-6 text-xs text-muted-foreground">
              This page describes the <code className="rounded bg-muted px-1 py-0.5">youtube.readonly</code> usage as currently implemented. If the product later requests different scopes or accesses additional YouTube
              data, this policy will be updated before submission for re-verification.
            </p>
          </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
