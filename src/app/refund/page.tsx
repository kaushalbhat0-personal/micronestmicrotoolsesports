import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "MicroNest refund and cancellation policy — subscription software for esports operations. Digital service, billing per workspace.",
};

export default function RefundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-3xl font-normal tracking-tight">Refund &amp; Cancellation Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

            <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
              <section>
                <h2 className="text-lg font-semibold">1. Digital service — subscription software</h2>
                <p className="mt-2 text-muted-foreground">
                  MicroNest is a subscription software platform providing focused workflow tools for esports teams, organizations, creators, and tournament operators. All purchases grant digital software access to a specific organization/workspace, billed per the selected plan — monthly or yearly — in INR as displayed at checkout. No physical products are shipped.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">2. What you are purchasing</h2>
                <p className="mt-2 text-muted-foreground">
                  You are subscribing to software access for a tool or bundled All Access, delivered digitally to your organization/workspace after payment verification. MicroNest provides the calculator/tracking tools; you operate your own esports workflows, sponsorship relationships, and prize distributions. MicroNest does not hold, escrow, or transfer prize money and does not broker sponsorships.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">3. Cancellation vs refund — distinct</h2>
                <div className="mt-3 space-y-3">
                  <div className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                    <h3 className="text-sm font-semibold">Cancellation</h3>
                    <p className="mt-1 text-muted-foreground">
                      You may stop using any tool at any time and choose not to renew. Access remains active until the current period’s expiry — shown as “Active until” in Dashboard → Settings → Billing. Renewal requires an explicit new purchase; there is no automatic recurring charge beyond a completed checkout.
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                    <h3 className="text-sm font-semibold">Subscription expiration</h3>
                    <p className="mt-1 text-muted-foreground">
                      When a plan period ends without renewal, the associated entitlement expires and the workspace loses access to that tool (unless another active entitlement covers it). Historical workspace data (campaigns, evidence) remains per normal retention until workspace removal.
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                    <h3 className="text-sm font-semibold">Refund</h3>
                    <p className="mt-1 text-muted-foreground">
                      Refund is a return of payment already made, distinct from stopping future renewals. Refunds are not automated in the current product; any refund request is reviewed case-by-case by support against applicable law and the circumstances of the purchase. Digital access delivered and used before a refund request will be considered.
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                    <h3 className="text-sm font-semibold">Renewal</h3>
                    <p className="mt-1 text-muted-foreground">
                      Renewal extends access for a new period (monthly/yearly) at the then-displayed price. You will see the selected plan, amount, and billing period before confirming checkout via Razorpay. Confirming the Razorpay checkout creates a new order; verification provisions a new entitlement period.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-muted-foreground">
                  Cancelling (not renewing) does not automatically refund a current paid period; expiring without renewal simply lets access lapse at period end.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">4. How to manage your subscription</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>View current access, plan, and “Active until” dates in Dashboard → Settings → Billing.</li>
                  <li>Renew by selecting a plan and completing checkout via Razorpay; the new period starts from verification.</li>
                  <li>To stop future billing, simply do not purchase a new period — no separate cancellation button is required because billing is per-purchase, not auto-recurring.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold">5. Digital delivery</h2>
                <p className="mt-2 text-muted-foreground">
                  Purchases provide digital software access, provisioned instantly to your organization/workspace after payment verification (Razorpay order → payment → webhook → entitlement). No shipping is involved. See <a href="/digital-delivery" className="underline underline-offset-4 hover:text-foreground">Digital Delivery</a> for details.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">6. Contact for billing questions</h2>
                <p className="mt-2 text-muted-foreground">
                  For refund or cancellation questions, contact the workspace owner or MicroNest administrator via the Dashboard. The repository does not currently publish a dedicated billing support email; jurisdiction, entity, GSTIN, and formal contact are intentionally omitted pending formal incorporation. Where a support email is later published, this section will be updated. Do not submit Razorpay payment IDs or signatures via public channels.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
