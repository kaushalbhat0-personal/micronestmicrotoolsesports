import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: "MicroNest shipping policy — digital SaaS with no physical shipment. Software access delivered instantly to your workspace.",
};

export default function ShippingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
            <h1 className="font-display text-3xl font-normal tracking-tight">Shipping Policy</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: October 13, 2026</p>

            <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
              <section>
                <h2 className="text-lg font-semibold">No physical shipping</h2>
                <p className="mt-2 text-muted-foreground">
                  MicroNest is a subscription software platform for esports operations. All purchases are for digital services — subscription access to tools such as Sponsorship Tracking and Prize Pool Splitter, billed per organization/workspace. <strong className="font-medium text-foreground">No physical products are shipped.</strong>
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Digital delivery</h2>
                <p className="mt-2 text-muted-foreground">
                  Software access is provisioned digitally to your organization/workspace immediately after payment verification. See our <a href="/digital-delivery" className="underline underline-offset-4 hover:text-foreground">Digital Delivery Policy</a> for the full delivery flow.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">For payment providers</h2>
                <p className="mt-2 text-muted-foreground">
                  If a checkout field requires a shipping value, select <strong className="font-medium text-foreground">“No shipping — digital delivery only.”</strong> There is no tracking number or courier.
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
