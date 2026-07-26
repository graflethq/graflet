import type { Metadata } from "next";
import { Title, Lede, H2, P, UL, ProseLink } from "@/components/legal-prose";
import { AnalyticsOptOut } from "@/components/analytics-opt-out";
import { LINKS } from "@/lib/links";

export const metadata: Metadata = {
  title: "Privacy · Graflet",
  description:
    "What Graflet stores, what PostHog measures, session recording, the marketing-consent model, and how to opt out or be deleted.",
};

/**
 * Privacy (ADR-0006 for email consent, ADR-0010 for analytics).
 *
 * This page used to say the site "captures nothing" and shared nothing with any
 * third party. Both stopped being true the moment PostHog was wired in, so it was
 * rewritten rather than amended (ticket 02) — and it ships BEFORE any capture does,
 * because a privacy page that contradicts live behaviour is a liability, not a typo.
 * Change what the code sends, change this page in the same commit.
 */
export default function PrivacyPage() {
  return (
    <article>
      <Title>Privacy</Title>
      <Lede>
        Graflet is a free, open-source tool. We store the minimum needed to give you the graph you asked for, we
        measure how the site and the service are used, and — only if you opt in — we email you about new releases.
        This page says exactly what each of those means and how to stop any of them.
      </Lede>
      <P>Last updated 26 July 2026.</P>

      <H2>What we store ourselves</H2>
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
          <code className="text-foreground">yes</code> or <code className="text-foreground">no</code>.
        </li>
        <li>
          Three timestamps and nothing more interesting: when you first signed in, when you answered the email
          question, and whether you answered it on the website or in the CLI.
        </li>
      </UL>
      <P>Two other things exist because you asked for them, and go away with them:</P>
      <UL>
        <li>
          <strong className="text-foreground">CLI sign-ins</strong> — one row per logged-in machine, holding a{" "}
          <em>hash</em> of that machine&apos;s access token and when it was issued. The token itself is never stored,
          so a copy of our database hands over no live sessions.
        </li>
        <li>
          <strong className="text-foreground">Watched libraries</strong> — if you ask the CLI to watch a doc, we
          store which doc, so we can email you when it is rebuilt. Unwatch it and the row is gone.
        </li>
      </UL>

      <H2>What is stored in your browser</H2>
      <P>Here is the whole list:</P>
      <UL>
        <li>
          <strong className="text-foreground">Before you sign in — nothing.</strong> No analytics cookie, no stored
          identifier. You are counted, and the count is all that leaves.
        </li>
        <li>
          <strong className="text-foreground">After you sign in</strong> — one entry,{" "}
          <code className="text-foreground">graflet:session</code>, holding your GitHub handle and your answer to the
          email question, so you are not asked again. It is not a credential and grants access to nothing; signing
          out deletes it.
        </li>
        <li>
          <strong className="text-foreground">After you sign in</strong>, PostHog also starts keeping its own
          entries (their names begin <code className="text-foreground">ph_</code>) so it can recognise you across
          visits. That is the difference between an anonymous visitor and an identified person, and signing in is
          what causes it.
        </li>
        <li>
          <strong className="text-foreground">If you turn analytics off</strong> — one entry,{" "}
          <code className="text-foreground">graflet:analytics-opt-out</code>, which is how we remember to keep
          measurement off.
        </li>
      </UL>

      <H2 id="analytics">Analytics: PostHog</H2>
      <P>
        We use <ProseLink href="https://posthog.com/privacy">PostHog</ProseLink> to measure how the site and the
        service are used. PostHog is a processor acting on our instructions, and the data it holds for us is stored
        in the <strong className="text-foreground">United States</strong>. Analytics requests from this site go to a
        Graflet subdomain rather than to PostHog directly, so a content blocker may not stop them — the switch{" "}
        <ProseLink href="#opt-out">below</ProseLink> does.
      </P>
      <P>
        <strong className="text-foreground">Before you sign in you are anonymous.</strong> Visits are counted, but
        nothing is written to your device — no analytics cookie, no stored identifier — and no profile is created
        for you.
      </P>
      <P>
        <strong className="text-foreground">Signing in with GitHub makes you an identified person</strong> in
        PostHog, keyed by your <code className="text-foreground">github_id</code>, carrying your GitHub login and
        your email. Those three fields, and nothing else: no avatar, no organisations, no repository names, no
        access token. From that point your site visits and your graph downloads are one timeline, which is how we
        can tell whether the thing we built is the thing people use.
      </P>
      <P>What is recorded:</P>
      <UL>
        <li>Pages you visit, where you arrived from, and roughly where you are (country/region, from your IP).</li>
        <li>Clicks and taps, including the text on the button you clicked — never the text you type into a field.</li>
        <li>
          Catalog searches: the search term itself, lowercased and cut to 64 characters, plus how many results it
          matched. This is the one piece of typed text we send on purpose, and it is how we learn which libraries to
          add next — a search that matches nothing is a library we should carry.
        </li>
        <li>Copying an install command, starting a sign-in, completing one, and downloading a graph.</li>
        <li>Errors, so we find out something is broken before you have to tell us.</li>
      </UL>
      <P>
        Downloads and sign-ins are recorded by our own server, not by your browser, because most downloads happen in
        the CLI where there is no browser at all.
      </P>

      <H2>Session recording</H2>
      <P>
        Sessions on this site may be recorded and replayed as a video: mouse movement, clicks, scrolling, and which
        pages you moved between.{" "}
        <strong className="text-foreground">What you type is masked before the recording leaves your browser</strong>{" "}
        — form fields come through as blanked-out boxes, so passwords and anything else you enter are never in the
        video. The only typed text that reaches us is the catalog search term described above, and that arrives as
        its own event, not from the recording.
      </P>

      <H2>What we never do</H2>
      <UL>
        <li>We do not sell your data, and we do not share it with anyone for their own marketing.</li>
        <li>
          The companies that see any of it are processors working for us: PostHog for analytics, Resend for email,
          and Freemius, who are the merchant of record for supporter licences and take payment details we never see.
        </li>
        <li>There are no advertising trackers, no ad networks, and no third-party marketing pixels on this site.</li>
        <li>
          The CLI sends no usage data. It talks to the Graflet API to list the catalog and download graphs, and that
          is all. If that ever changes, it will be opt-in, off unless you say yes, and this page will say so before
          that version ships.
        </li>
      </UL>
      <P>
        One thing the CLI does that is worth knowing anyway: a library&apos;s Markdown is downloaded straight from
        GitHub, as a plain archive from <code className="text-foreground">codeload.github.com</code>. We never see
        that request and it carries no account of yours, but GitHub does see your IP address and which library you
        asked for — exactly as if you had cloned the repository yourself.
      </P>

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
      <P>
        That consent covers <em>email only</em>. Analytics is a separate thing with its own switch — answering the
        marketing question either way neither turns analytics on nor off.
      </P>

      <H2 id="opt-out">Turn analytics off</H2>
      <P>
        This switch stops measurement of this site in this browser, right away and on every later visit. It works by
        remembering one preference on your device, written only once you have asked for it.
      </P>
      <AnalyticsOptOut />
      <P>
        It covers the website. Sign-ins and graph downloads are recorded by our server against your account, so if
        you want those stopped too, ask us to delete your data below and use the tool signed out.
      </P>

      <H2 id="delete">Delete your data</H2>
      <P>
        There is no self-serve delete button yet — we are not going to pretend otherwise. Email{" "}
        <ProseLink href="mailto:graflet@rnui.dev">graflet@rnui.dev</ProseLink> from the address on your account, or
        open an issue in the <ProseLink href={LINKS.github}>repository</ProseLink>, and we will delete both halves:
        the row we hold and the person PostHog holds for us. We will confirm when it is done.
      </P>

      <H2>The code</H2>
      <P>
        Everything here is verifiable — the storage, the consent handling and every analytics call are open source.
        Read it in the <ProseLink href={LINKS.github}>repository</ProseLink>.
      </P>
    </article>
  );
}
