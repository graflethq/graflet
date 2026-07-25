import { describe, it, expect } from "vitest";
import { TIERS, checkoutUrl, machines, SUPPORT_PLAN_ID, SUPPORT_PRODUCT_ID } from "./support";

describe("supporter tiers", () => {
  it("runs $10 to $100 in tens, with no gaps or repeats", () => {
    expect(TIERS.map((t) => t.usd)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("gives every tier a distinct licence count — it is the tier's key in the checkout URL", () => {
    const counts = TIERS.map((t) => t.licenses);
    expect(new Set(counts).size).toBe(TIERS.length);
    // Monotonic: paying more never buys fewer activations.
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
  });

  it("builds the live hosted-checkout URL for a tier", () => {
    expect(checkoutUrl({ usd: 50, licenses: 10 }, false)).toBe(
      `https://checkout.freemius.com/app/${SUPPORT_PRODUCT_ID}/plan/${SUPPORT_PLAN_ID}/licenses/10/`,
    );
  });

  it("flags sandbox checkouts so a test link can never be mistaken for a live one", () => {
    expect(checkoutUrl({ usd: 10, licenses: 1 }, true)).toMatch(/\?sandbox=true$/);
  });

  it("pluralises the licence unit", () => {
    expect(machines({ usd: 10, licenses: 1 })).toBe("1 machine");
    expect(machines({ usd: 50, licenses: 10 })).toBe("10 machines");
  });
});
