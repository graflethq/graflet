import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/landing-sections";
import { Button } from "@/components/ui/button";
import { TIERS, SANDBOX, checkoutUrl, machines } from "@/lib/support";

export const metadata: Metadata = {
  title: "Pricing · Graflet",
  description:
    "Graflet is free and open source. A supporter licence is optional — pick any amount from $10 to $100. Same files at every tier.",
};

/**
 * Pricing / supporter page.
 *
 * The CLI and the docs stay free (ADR-0005 gates only the KG download, and that
 * gate is a GitHub sign-in, not a payment). This page sells one optional thing: a
 * lifetime supporter licence at a price the buyer picks.
 *
 * Ten buttons rather than an amount box because Freemius's checkout has no
 * custom-amount parameter — see lib/support.ts. Nothing here is withheld from the
 * cheapest tier; say so on the page rather than implying a feature ladder.
 */
export default function PricingPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 sm:px-6">
        <h1 className="font-mono text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          Graflet is free. The CLI, the docs, and the catalog cost nothing and always will — the only thing behind a
          gate is the graph download, and that gate is a GitHub sign-in, not a payment.
        </p>

        {SANDBOX && (
          <p className="mt-6 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 font-mono text-xs text-primary">
            Sandbox mode — these buttons open Freemius&apos;s test checkout. No money moves.
          </p>
        )}

        <section className="mt-12">
          <h2 className="font-mono text-2xl font-semibold tracking-tight">Support the project</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If Graflet saved you time, you can buy a supporter licence. It is a one-off payment — not a subscription —
            and it grants a lifetime licence to the Graflet knowledge-graph bundles and CLI.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Every tier ships the same files.</strong> A higher tier activates on
            more machines and funds more of the work; it does not unlock anything held back from the $10 tier.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TIERS.map((tier) => (
              <li key={tier.usd}>
                <Button asChild variant="outline" className="h-auto w-full flex-col items-start gap-1 px-4 py-3">
                  <a href={checkoutUrl(tier)} rel="noopener">
                    <span className="font-mono text-lg font-semibold text-foreground">${tier.usd}</span>
                    <span className="font-mono text-[11px] font-normal text-muted-foreground">{machines(tier)}</span>
                  </a>
                </Button>
              </li>
            ))}
          </ul>

          <p className="mt-6 font-mono text-xs text-muted-foreground">
            One-off · USD · Sold by Freemius, our merchant of record ·{" "}
            <a href="/refunds" className="text-primary hover:underline">
              30-day refund, no questions asked
            </a>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
