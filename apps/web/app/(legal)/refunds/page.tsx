import type { Metadata } from "next";
import { Title, Lede, H2, P, UL, ProseLink } from "@/components/legal-prose";

export const metadata: Metadata = {
  title: "Refunds · Graflet",
  description: "30-day refund on any Graflet supporter licence. No questions asked.",
};

/**
 * Refund policy. The wording has to match what Freemius shows at checkout, because
 * they are the merchant of record and their EULA is what the buyer agrees to — the
 * "Flexible / Double Guarantee" policy at 30 days. Keep the two in sync: change one,
 * change the other.
 */
export default function RefundsPage() {
  return (
    <article>
      <Title>Refund policy</Title>
      <Lede>
        Thirty days, full refund, no questions asked. If you want your money back, you get your money back.
      </Lede>

      <H2>The policy</H2>
      <P>
        Any supporter licence bought through Graflet can be refunded in full within{" "}
        <strong className="text-foreground">30 days</strong> of purchase. You do not have to give a reason, report a
        fault, or return anything. Ask, and it is refunded.
      </P>
      <P>
        This is the wording our merchant of record shows you at checkout, and it is the policy we are bound by:{" "}
        <em>
          &ldquo;You are fully protected by our 100% No-Risk Double Guarantee. If you don&apos;t like our app over the
          next 30 days, we&apos;ll happily refund 100% of your money. No questions asked.&rdquo;
        </em>
      </P>

      <H2>How to ask</H2>
      <P>
        Purchases are handled by <ProseLink href="https://freemius.com">Freemius</ProseLink>, who act as the merchant
        of record — they take the payment, handle the tax, and issue the refund. Either route works:
      </P>
      <UL>
        <li>
          Reply to your purchase receipt, or use the customer portal link in it, and request a refund.
        </li>
        <li>
          Or open an issue in the <ProseLink href="https://github.com/graflethq/graflet">repository</ProseLink> and we
          will start it for you.
        </li>
      </UL>
      <P>
        The refund goes back to the card or account you paid with. How long it takes to appear is your bank&apos;s call,
        not ours — usually a few working days.
      </P>

      <H2>After 30 days</H2>
      <P>
        We are not obliged to refund past 30 days, but ask anyway if something went wrong. A supporter licence is not a
        subscription — nothing renews, so there is no recurring charge to cancel.
      </P>

      <H2>What you keep</H2>
      <P>
        A refund ends the licence. Graflet itself is free and open source, so refunding a supporter licence never takes
        away the CLI or the docs — those were never the thing you paid for. See the{" "}
        <ProseLink href="/pricing">pricing page</ProseLink> for what a licence actually covers.
      </P>
    </article>
  );
}
