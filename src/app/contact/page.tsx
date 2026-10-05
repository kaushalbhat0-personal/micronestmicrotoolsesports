import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact MicroNest — subscription software for esports operations. Workspace-based support via Dashboard.",
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-3xl font-normal tracking-tight">Contact</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

            <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
              <section>
                <h2 className="text-lg font-semibold">How to reach us</h2>
                <p className="mt-2 text-muted-foreground">
                  MicroNest is a subscription software platform for esports operations. For account, billing, or tool questions, first contact the workspace owner or MicroNest administrator via your Dashboard (Settings → Billing).
                </p>
                <div className="mt-4 rounded-[12px] border border-border bg-surface-muted/30 p-4">
                  <h3 className="text-sm font-semibold">Business contact — disclosure</h3>
                  <p className="mt-1 text-muted-foreground">
                    The repository does not currently publish a dedicated support email, phone, registered address, legal entity name, GSTIN, or jurisdiction. This information is intentionally omitted pending formal incorporation. Where a support email, legal entity, and registered address are later published, this page will be updated. Do not submit Razorpay payment IDs, signatures, OAuth secrets, or tokens via public channels.
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    For Razorpay or business verification, provide the Razorpay order notes: <code className="rounded bg-muted px-1 py-0.5">product_type: software_subscription</code> and <code className="rounded bg-muted px-1 py-0.5">business: MicroNest — subscription software for esports operations</code>.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold">What not to send</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Razorpay payment signatures or secrets</li>
                  <li>OAuth client secrets, access tokens, or refresh tokens</li>
                  <li>Full card numbers</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
