import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Digital Delivery Policy — MicroNest",
  description: "MicroNest MicroTools — Esports digital delivery. Support: info.micronest@gmail.com, Pune, Maharashtra, India. Instant workspace access after Razorpay verification.",
  alternates: { canonical: "/digital-delivery" },
};

export default function DigitalDeliveryPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-3xl font-normal tracking-tight">Digital Delivery Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

            <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
              <section>
                <h2 className="text-lg font-semibold">1. No physical products</h2>
                <p className="mt-2 text-muted-foreground">
                  MicroNest is a subscription software platform. No physical products are shipped. All purchases provide digital software access to tools such as Sponsorship Tracking and Prize Pool Splitter.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">2. What delivery means</h2>
                <p className="mt-2 text-muted-foreground">
                  Delivery is the activation of software access for your workspace. After you select a plan (monthly or yearly) and complete checkout via Razorpay, MicroNest verifies the payment and gives the selected tool or All Access to that workspace. You can confirm delivery in Dashboard → Settings → Billing, where current access and “Active until” are displayed.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">3. Delivery flow</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
                  <li>Choose a plan (e.g., Sponsorship Tracking — Monthly ₹1,499 or All Access — Monthly ₹2,499) in Settings → Billing.</li>
                  <li>Complete checkout via Razorpay — you will see the plan name, amount in INR, currency, and billing period before confirming.</li>
                  <li>MicroNest creates an order with Razorpay (receipt = MicroNest order ID).</li>
                  <li>After payment, MicroNest confirms the payment and activates access for your workspace.</li>
                  <li>Access becomes available immediately after verification — no manual activation or shipping delay.</li>
                </ol>
              </section>

              <section>
                <h2 className="text-lg font-semibold">4. No shipping</h2>
                <p className="mt-2 text-muted-foreground">
                  Because this is a digital SaaS product, there is no shipping, no tracking number, no courier, and no customs handling. If a payment provider requires a “shipping” field, the correct value is <strong className="font-medium text-foreground">“No shipping — digital delivery only.”</strong>
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">5. Access association</h2>
                <p className="mt-2 text-muted-foreground">
                  Access belongs to the workspace you selected at checkout. It is not tied to a single device or email beyond workspace membership. Only members of that workspace can use the active tools.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">6. Tool boundaries</h2>
                <p className="mt-2 text-muted-foreground">
                  Prize Pool Splitter helps you calculate and organize prize-pool distributions; MicroNest does not hold, escrow, or transfer prize money. Sponsorship Tracking helps you verify sponsor deliverables; MicroNest does not broker sponsorships. Delivery is of the calculation/tracking software, not of funds or sponsorship deals.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">7. Support</h2>
                <p className="mt-2 text-muted-foreground">
                  For delivery questions, check Dashboard → Settings → Billing for current access status or contact <a href="mailto:info.micronest@gmail.com" className="underline underline-offset-4 hover:text-foreground">info.micronest@gmail.com</a>. Location: Pune, Maharashtra, India.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Do not send payment details or passwords by email. No refunds after purchase and provisioning — see <a href="/refund" className="underline underline-offset-4 hover:text-foreground">Refund &amp; Cancellation Policy</a>.</p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
