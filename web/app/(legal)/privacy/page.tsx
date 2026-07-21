import type { Metadata } from "next";
import { Title, Lede, H2, P, UL, ProseLink } from "@/components/legal-prose";
import { LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "Privacy · docs-kg",
  description: "What docs-kg stores, the marketing-consent model, and how to withdraw consent or unsubscribe.",
};

// Privacy (ticket 07 / ADR-0006). Static, public, captures nothing.
export default function PrivacyPage() {
  return (
    <article>
      <Title>Privacy</Title>
      <Lede>
        docs-kg is a free, open-source tool. We store the minimum needed to give you the graph you asked for and,
        only if you opt in, to email you about new releases. This page says exactly what that is and how to undo it.
      </Lede>

      <H2>What we store</H2>
      <P>When you sign in with GitHub, we keep one row for your account:</P>
      <UL>
        <li>
          <code className="text-foreground">github_id</code> — your GitHub account id, so we recognize you across
          sign-ins and the CLI.
        </li>
        <li>
          <code className="text-foreground">email</code> — the address GitHub returns, used only for transactional
          and (if opted in) product emails.
        </li>
        <li>
          <code className="text-foreground">marketing_consent</code> — whether you agreed to product emails. It is{" "}
          <em>tri-state</em>: <code className="text-foreground">unset</code> until you answer, then{" "}
          <code className="text-foreground">yes</code> or <code className="text-foreground">no</code> — recorded
          with the time and where you answered it.
        </li>
      </UL>
      <P>We do not sell your data, and we do not share it with third parties for their own marketing.</P>

      <H2>The three kinds of email</H2>
      <UL>
        <li>
          <strong className="text-foreground">Transactional</strong> — your download is ready, or a security notice.
          Sent to everyone; no consent needed.
        </li>
        <li>
          <strong className="text-foreground">Notifications</strong> — a doc you asked the CLI to watch was rebuilt.
          Sent only for docs you chose to watch.
        </li>
        <li>
          <strong className="text-foreground">Product / marketing</strong> — a new library or feature. Sent only if{" "}
          <code className="text-foreground">marketing_consent = yes</code>. The opt-in box is unticked by default —
          signing in never enrolls you.
        </li>
      </UL>

      <H2 id="withdraw">Withdraw consent or unsubscribe</H2>
      <P>
        Every product email carries a one-click unsubscribe link and a postal address; clicking it flips your
        consent to <code className="text-foreground">no</code> and stops all product email immediately. You can also
        stop doc notifications from the CLI at any time.
      </P>

      <H2>The code</H2>
      <P>
        Everything here is verifiable — the storage and consent handling are open source. Read it in the{" "}
        <ProseLink href={LINKS.github}>repository</ProseLink>.
      </P>
    </article>
  );
}
