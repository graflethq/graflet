"use client";

import { useEffect, useState } from "react";
import { capture, identifyPerson, rememberAnonId } from "@/lib/analytics";
import { authStartUrl } from "@/lib/api";
import { LINKS } from "@/lib/links";
import { isGithubId, readSession, writeSession, type Session } from "@/lib/session";

/**
 * The website signup flow (ticket 06 / ADR-0001, ADR-0006). "Sign in with GitHub"
 * is a top-level navigation to the backend's OAuth start — the client secret never
 * ships here. The marketing opt-in ships UNCHECKED; its answer rides through the
 * OAuth handoff and is recorded server-side. On return the backend hands back
 * `#login=&consent=` (never a token), which we remember so an already-answered
 * user is never re-prompted.
 *
 * This is the ONLY place the site captures the opt-in — the landing page carries
 * no such field (ADR-0005 / spec).
 */

export function JoinPanel() {
  const [optIn, setOptIn] = useState(false); // unchecked by default (ADR-0006)
  const [returnTo, setReturnTo] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);

  // Runs once on mount: adopt a fresh result from the OAuth redirect fragment
  // (then scrub it from the URL), else restore any remembered session.
  useEffect(() => {
    setReturnTo(`${window.location.origin}/join`);
    const frag = new URLSearchParams(window.location.hash.slice(1));
    const login = frag.get("login");
    const consent = frag.get("consent");
    if (frag.get("error")) {
      setFailed(true);
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (login && (consent === "yes" || consent === "no")) {
      // The backend hands back the numeric github_id (ticket 05). An old callback
      // without one still signs in fine — it just identifies nobody.
      const githubId = Number(frag.get("github_id"));
      const s: Session = { login, consent, ...(isGithubId(githubId) && { github_id: githubId }) };
      writeSession(s);
      setSession(s);
      // Here, not in AnalyticsProvider: the provider's effect already ran on this
      // load, before this fragment had been read. On every LATER load the provider
      // bootstraps the identity itself and this is not reached.
      if (s.github_id) identifyPerson(s.github_id, login);
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    setSession(readSession());
  }, []);

  // Already answered → never re-ask; just confirm where they stand (ADR-0006).
  if (session) {
    return (
      <Card>
        <h1 className="font-mono text-2xl font-semibold tracking-tight">
          Signed in as <span className="text-primary">{session.login}</span>
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          You&apos;re on the Graflet audience list.{" "}
          {session.consent === "yes"
            ? "We'll email you when a new library ships or a doc's graph is rebuilt."
            : "You opted out of product emails — you'll still get updates for docs you watch via the CLI."}
        </p>
        {!session.github_id && (
          // Signed in before ticket 05, so this browser never learned the account
          // id and nothing they do can be attributed to them. Re-running sign-in is
          // the only way to get it — the site has no authenticated session to ask
          // with, and the users table stores no login to map back from.
          //
          // A link, not the sign-in panel: showing that again would put the
          // marketing opt-in box in front of someone who already answered, which
          // ADR-0006 forbids. This carries their recorded answer straight through,
          // so the server's guard sees nothing to change and nobody is re-asked.
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            <a href={authStartUrl(session.consent, returnTo)} className="text-primary hover:underline">
              Reconnect your account
            </a>{" "}
            — this browser signed in before we started recording which account is which. It changes nothing about
            your email settings.
          </p>
        )}
        <p className="mt-4 font-mono text-xs text-muted-foreground">
          Manage or withdraw consent anytime — see our{" "}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy page
          </a>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="font-mono text-2xl font-semibold tracking-tight">Join the Graflet audience</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Sign in with GitHub — the same identity the CLI uses. It joins the audience and lets you watch docs for
        updates. Installing, browsing, and copying commands never need an account.
      </p>

      {failed && (
        <p className="mt-4 font-mono text-sm text-destructive">Sign-in didn&apos;t complete. You can try again.</p>
      )}

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          Email me about new Graflet releases and product updates.{" "}
          <span className="text-muted-foreground/70">Optional — leave unticked to sign in without it. Unsubscribe anytime.</span>
        </span>
      </label>

      <a
        href={authStartUrl(optIn ? "yes" : "no", returnTo)}
        // Front half of the sign-in funnel; the back half is `signin_completed` from
        // the Worker (ticket 06). Fired inline before a top-level navigation on
        // purpose — posthog-js flushes its queue on pagehide, so the event still lands.
        // `rememberAnonId` parks the anonymous id for the round trip to GitHub, which
        // is what lets everything done before this click end up on the same person
        // (ticket 05). This click is the first moment anything is written to the
        // device, and only because signing in is an explicit act.
        onClick={() => {
          capture("signin_started", { surface: "join_panel" });
          rememberAnonId();
        }}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-mono text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Sign in with GitHub
      </a>

      <p className="mt-4 font-mono text-xs text-muted-foreground">
        By signing in you agree to our{" "}
        <a href="/terms" className="text-primary hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy
        </a>
        . Prefer the CLI?{" "}
        <a href={LINKS.docs} className="text-primary hover:underline">
          Read the docs
        </a>
        .
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-card p-8 sm:p-10">{children}</div>
  );
}
