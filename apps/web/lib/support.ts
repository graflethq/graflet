/**
 * Supporter tiers, sold through Freemius (store 18631).
 *
 * Freemius checkout takes `plan_id` / `pricing_id` / `licenses` / `billing_cycle` /
 * `currency` — there is no parameter for a buyer-typed amount. So a price ladder can
 * only be expressed as one pricing row per amount, and the axis those rows sit on is
 * activation count. `licenses` is therefore doing two jobs: it picks the tier in the
 * checkout URL, and it is genuinely how many machines the licence covers.
 *
 * Every tier grants the same files. Paying more buys more activations and funds the
 * work; it does not unlock anything withheld from the $10 tier.
 */

export const SUPPORT_PRODUCT_ID = 35608;
export const SUPPORT_PLAN_ID = 58708;

export type Tier = {
  /** Price in whole US dollars — one-off, not a subscription. */
  usd: number;
  /** Machines the licence activates on. Also the tier's key in the checkout URL. */
  licenses: number;
};

export const TIERS: readonly Tier[] = [
  { usd: 10, licenses: 1 },
  { usd: 20, licenses: 2 },
  { usd: 30, licenses: 3 },
  { usd: 40, licenses: 5 },
  { usd: 50, licenses: 10 },
  { usd: 60, licenses: 15 },
  { usd: 70, licenses: 20 },
  { usd: 80, licenses: 25 },
  { usd: 90, licenses: 50 },
  { usd: 100, licenses: 100 },
] as const;

/**
 * Set `NEXT_PUBLIC_FREEMIUS_SANDBOX=1` to point every button at Freemius's test
 * checkout, which takes the 4242… test card and moves no money. Unset in production
 * builds — a sandbox link in prod silently accepts "payments" that never arrive.
 */
export const SANDBOX = process.env.NEXT_PUBLIC_FREEMIUS_SANDBOX === "1";

/** Hosted-checkout URL for one tier. Freemius appends `?sandbox=true` for test mode. */
export function checkoutUrl(tier: Tier, sandbox: boolean = SANDBOX): string {
  const base = `https://checkout.freemius.com/app/${SUPPORT_PRODUCT_ID}/plan/${SUPPORT_PLAN_ID}/licenses/${tier.licenses}/`;
  return sandbox ? `${base}?sandbox=true` : base;
}

/** "1 machine" / "10 machines" — the licence's plain-language unit. */
export function machines(tier: Tier): string {
  return tier.licenses === 1 ? "1 machine" : `${tier.licenses} machines`;
}
