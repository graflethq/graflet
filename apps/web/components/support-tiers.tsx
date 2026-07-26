"use client";

import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";
import { TIERS, checkoutUrl, machines } from "@/lib/support";

/**
 * The ten supporter-tier buttons, split out of `app/support/page.tsx` for one
 * reason: `support_click` (ticket 04) needs a click handler, and the page itself
 * has to stay a server component to keep exporting `metadata`.
 *
 * Every tier ships the same files — the ladder is activation count, not features
 * (ADR-0009, lib/support.ts).
 */
export function SupportTiers() {
  return (
    <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {TIERS.map((tier) => (
        <li key={tier.usd}>
          <Button asChild variant="outline" className="h-auto w-full flex-col items-start gap-1 px-4 py-3">
            <a
              href={checkoutUrl(tier)}
              rel="noopener"
              onClick={() => capture("support_click", { tier: tier.usd })}
            >
              <span className="font-mono text-lg font-semibold text-foreground">${tier.usd}</span>
              <span className="font-mono text-[11px] font-normal text-muted-foreground">{machines(tier)}</span>
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}
