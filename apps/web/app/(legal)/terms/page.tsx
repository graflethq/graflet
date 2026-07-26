import type { Metadata } from "next";
import { Title, Lede, H2, P, ProseLink } from "@/components/legal-prose";
import { LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "Terms · Graflet",
  description: "Graflet is free and open source, provided as-is with no warranty.",
};

// Terms (ticket 07). Static and public; measured like every other page (ADR-0010) —
// what is collected is spelled out on /privacy, and nothing here contradicts it.
export default function TermsPage() {
  return (
    <article>
      <Title>Terms of use</Title>
      <Lede>
        Graflet is free and <ProseLink href={LINKS.github}>open source</ProseLink>. Nothing is paywalled; the one thing
        you can buy is an optional <ProseLink href="/support">supporter licence</ProseLink>. Use it however you like
        within the terms below.
      </Lede>

      <H2>Free and open source</H2>
      <P>
        The tool, its website, and its backend are released under a permissive{" "}
        <ProseLink href={LINKS.license}>open-source license</ProseLink>. You can read, fork, and run the code yourself. Installing,
        browsing, and copying commands never require an account; signing in with GitHub only unlocks graph downloads
        and, optionally, update emails.
      </P>

      <H2>Provided as-is, no warranty</H2>
      <P>
        The service and everything it delivers — the Markdown docs and the knowledge graphs — are provided{" "}
        <strong className="text-foreground">as-is, without warranty of any kind</strong>, express or implied. We do
        not guarantee availability, accuracy, or fitness for any purpose, and we are not liable for any damages
        arising from use of the tool. Verify anything important against the upstream source.
      </P>

      <H2>Redistributed docs stay under their own licenses</H2>
      <P>
        The docs Graflet redistributes belong to their upstream projects and remain under those projects' licenses.
        We ship only permissively licensed docs; each library's source repository and license are listed on the{" "}
        <ProseLink href="/attribution">attribution page</ProseLink>.
      </P>

      <H2>Supporter licences</H2>
      <P>
        Buying a <ProseLink href="/support">supporter licence</ProseLink> is optional and changes nothing about the
        terms above — the tool stays free, and every tier ships the same files. Purchases are sold by Freemius as
        merchant of record, under their EULA, and are refundable in full for 30 days: see the{" "}
        <ProseLink href="/refunds">refund policy</ProseLink>.
      </P>

      <H2>Questions</H2>
      <P>
        Open an issue in the <ProseLink href={LINKS.github}>repository</ProseLink>.
      </P>
    </article>
  );
}
