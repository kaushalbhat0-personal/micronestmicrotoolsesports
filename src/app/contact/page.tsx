import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Mail, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact — MicroNest",
  description: "Contact MicroNest MicroTools — Esports. Support: info.micronest@gmail.com. Location: Pune, Maharashtra, India. Subscription software for esports operations.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-nest py-10 lg:py-14">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Support</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight">Contact</h1>
            <p className="mt-2 text-sm text-muted-foreground">MicroNest MicroTools — Esports · Subscription software for esports operations · Pune, Maharashtra, India</p>
            <p className="mt-1 text-xs text-muted-foreground">Last updated: October 13, 2026</p>

            <div className="mt-8 max-w-none space-y-8 text-sm leading-6">
              <section className="rounded-[16px] border border-primary/15 bg-card p-5 sm:p-6">
                <h2 className="text-base font-semibold">Support</h2>
                <p className="mt-2 text-muted-foreground">For product, billing, payment, refund, or workspace-access questions, contact our public support email. This works for unauthenticated visitors — no login required.</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="mailto:info.micronest@gmail.com"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Mail className="h-4 w-4" aria-hidden />
                    info.micronest@gmail.com
                  </a>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Pune, Maharashtra, India
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                    <h3 className="text-sm font-semibold">What we help with</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                      <li>Product questions (Sponsorship Tracking, Prize Pool Splitter, All Access)</li>
                      <li>Billing, payment, and Razorpay issues</li>
                      <li>Refund / purchase-policy questions</li>
                      <li>Account and workspace access</li>
                      <li>Pre-purchase questions</li>
                    </ul>
                  </div>
                  <div className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                    <h3 className="text-sm font-semibold">Business identity</h3>
                    <p className="mt-2 text-muted-foreground">
                      Brand: <span className="font-medium text-foreground">MicroNest</span> · Product: <span className="font-medium text-foreground">MicroNest MicroTools — Esports</span>
                    </p>
                    <p className="mt-1 text-muted-foreground">Operating location: <span className="font-medium text-foreground">Pune, Maharashtra, India</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">Support email is the official public contact for general, billing, and refund-related requests. MicroNest is currently not registered for GST.</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">For Razorpay or business verification, Razorpay order notes use <code className="rounded bg-muted px-1 py-0.5">product_type: software_subscription</code> and <code className="rounded bg-muted px-1 py-0.5">business: MicroNest — subscription software for esports operations</code>.</p>
              </section>

              <section className="rounded-[12px] border border-border bg-surface-muted/30 p-4">
                <h2 className="text-sm font-semibold">Do not send by email</h2>
                <p className="mt-1 text-muted-foreground">Do not send passwords, API secrets, OAuth credentials, Razorpay signatures, or other sensitive credentials by email.</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Razorpay payment signatures or secrets</li>
                  <li>OAuth client secrets, access tokens, or refresh tokens</li>
                  <li>Full card numbers</li>
                  <li>Passwords or API keys</li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">If you experienced a duplicate or erroneous charge, include the Razorpay payment ID (starting <code className="rounded bg-muted px-1 py-0.5">pay_</code>) and order receipt so support can investigate — refund eligibility follows the <a href="/refund" className="underline underline-offset-4 hover:text-foreground">Refund &amp; Cancellation Policy</a> (no refunds after purchase and provisioning, duplicate charges investigated).</p>
              </section>

              <section>
                <h2 className="text-lg font-semibold">Workspace members</h2>
                <p className="mt-2 text-muted-foreground">If you already have a workspace, you can also reach your workspace owner or check <span className="font-medium text-foreground">Dashboard → Settings → Billing</span> for current access and “Active until”.</p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
