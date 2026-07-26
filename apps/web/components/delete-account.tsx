"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { forgetPerson } from "@/lib/analytics";
import { accountDeleteStartUrl, deleteAccount } from "@/lib/api";
import { clearSession } from "@/lib/session";

/**
 * The delete button on /privacy (ticket 09 / ADR-0010's "erasure is now a
 * two-system operation").
 *
 * Two steps, and the split is a security property rather than a nicety: the GitHub
 * round trip proves who is asking, and this confirmation is what an attacker cannot
 * do on someone else's behalf. ADR-0010's ticket-09 amendment has the full reasoning
 * — read it before collapsing this into one click, because the one-click version was
 * the design that got rejected.
 */

/** Typed exactly, or the button stays disabled. An irreversible action deserves more
 *  than a click that could be a mis-tap on the way somewhere else. */
const CONFIRM_WORD = "DELETE";

type Stage = "idle" | "confirm" | "working" | "done";

/** Sized like the opt-out button directly above it on /privacy, coloured with the
 *  design system's destructive tokens (see components/ui/button.tsx). */
const DANGER_BUTTON =
  "inline-flex items-center justify-center rounded-lg bg-destructive/10 px-5 py-2.5 font-mono text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:bg-destructive/20 dark:hover:bg-destructive/30";

export function DeleteAccount() {
  const [stage, setStage] = useState<Stage>("idle");
  const [token, setToken] = useState("");
  const [login, setLogin] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [returnTo, setReturnTo] = useState("");

  // Runs once on mount: pick up a token from the OAuth return fragment and scrub it
  // out of the URL, so it never lingers in the address bar or in history.
  useEffect(() => {
    setReturnTo(`${window.location.origin}/privacy`);
    const frag = new URLSearchParams(window.location.hash.slice(1));
    const t = frag.get("delete_token");
    if (!t) return;
    setToken(t);
    setLogin(frag.get("login") ?? "");
    setStage("confirm");
    history.replaceState(null, "", `${window.location.pathname}#delete`);
  }, []);

  async function confirm() {
    setStage("working");
    setError("");
    try {
      await deleteAccount(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed. Please try again.");
      setStage("confirm"); // the token is one-shot only on success, so this can retry
      return;
    }
    // Both, and in this order. `clearSession` drops the local memory of who signed in
    // (lib/session); `forgetPerson` resets PostHog and puts persistence back to
    // memory-only — without it the next page view would immediately recreate a person
    // for the account just erased, which is the whole point of deleting it.
    clearSession();
    forgetPerson();
    setStage("done");
  }

  if (stage === "done") {
    return (
      <Panel>
        <p className="font-mono text-sm text-foreground">Your account has been deleted.</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Your row, your CLI sign-ins and your watched libraries are gone, and so is the person PostHog held for us —
          their event and recording deletion is queued and runs out of hours. This browser has been signed out. Nothing
          here identifies you any more; you can keep using Graflet signed out.
        </p>
      </Panel>
    );
  }

  if (stage === "idle") {
    return (
      <Panel>
        <a href={returnTo ? accountDeleteStartUrl(returnTo) : undefined} aria-disabled={!returnTo} className={DANGER_BUTTON}>
          Delete my account
        </a>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          You&apos;ll sign in with GitHub first, so we know it&apos;s you — then you confirm here. Nothing is deleted
          until you do.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <p className="font-mono text-sm text-foreground">
        Delete the Graflet account for {login ? <span className="text-primary">{login}</span> : "this GitHub user"}?
      </p>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        This cannot be undone. It removes your account row, every machine you&apos;re logged in on, your watched
        libraries, and the person PostHog holds for us.
      </p>
      <label className="mt-4 block font-mono text-xs text-muted-foreground">
        Type <span className="text-foreground">{CONFIRM_WORD}</span> to confirm
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={stage === "working"}
          autoComplete="off"
          className="mt-1 w-40 font-mono text-foreground"
        />
      </label>
      <button
        type="button"
        onClick={confirm}
        disabled={typed !== CONFIRM_WORD || stage === "working"}
        className={`mt-4 ${DANGER_BUTTON}`}
      >
        {stage === "working" ? "Deleting…" : "Delete everything"}
      </button>
      {error && <p className="mt-3 font-mono text-xs text-destructive">{error}</p>}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 rounded-lg border border-border bg-card p-5">{children}</div>;
}
