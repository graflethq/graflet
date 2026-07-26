"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { isAnalyticsOptedOut, takeAnonId } from "@/lib/analytics";
import { readSession } from "@/lib/session";

/**
 * Boots `posthog-js` once, client-side (ADR-0010, ticket 03).
 *
 * Anonymous by default: memory-only persistence and `identified_only` profiles,
 * so a visitor who never signs in is counted but has nothing written to their
 * device and creates no person row. Ticket 05 turns persistence on at sign-in.
 *
 * ponytail: renders null instead of wrapping children — there is no React context
 * to hand down. Event call sites import the `posthog` singleton directly, which is
 * the same instance this initialises.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // No token (local dev) or opted out on this device (/privacy button, ticket 02):
    // never init, so the SDK cannot write, record or send anything at all.
    if (!key || posthog.__loaded || isAnalyticsOptedOut()) return;

    // Who this browser already is, if anyone (ticket 05).
    const person = readSession()?.github_id;
    // Always consumed, whether or not it gets used: leaving a stale anonymous id in
    // sessionStorage would merge it onto whoever browses this tab next.
    const anon = takeAnonId();
    // A signed-in visitor boots straight into their identified id. Initialising
    // anonymously and identifying a beat later would mint a throwaway anonymous id
    // on every page load and merge it in, growing that person's alias list forever
    // — and posthog-js resets USER_STATE to anonymous for any non-identified
    // bootstrap, so an anon id here would silently un-identify them on each reload.
    const bootstrap = person
      ? { distinctID: String(person), isIdentifiedID: true }
      : anon
        ? // Marked anonymous on purpose: posthog-js only emits `$identify` carrying
          // `$anon_distinct_id` when the bootstrapped id is anonymous, and that is
          // the whole point of having carried it across the OAuth round trip.
          { distinctID: anon }
        : undefined;

    posthog.init(key, {
      // The managed reverse proxy — a first-party host, so blocker lists miss it.
      // Fallback if the proxy ever breaks: unset the var to go direct (ADR-0010).
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // In-app links (toolbar, "view in PostHog") must point at PostHog, not at our proxy.
      ui_host: "https://us.posthog.com",
      // Extensions load from <head>, or React's own head handling fights the
      // injected tags and hydration warns. This is the one thing the dated
      // `defaults` bundle was wanted for — the bundle is deliberately NOT set,
      // because `defaults >= '2026-01-30'` also turns on
      // `internal_or_test_user_hostname`, which calls setPersonProperties on
      // localhost and so creates a person row for an anonymous visitor.
      external_scripts_inject_target: "head",
      // Anonymous visitors keep memory-only persistence, so nothing is written to
      // their device. Storage is turned on only for someone already signed in —
      // the consent boundary ADR-0010 chose.
      persistence: person ? "localStorage+cookie" : "memory",
      person_profiles: "identified_only",
      ...(bootstrap && { bootstrap }),
      // An App Router navigation is a history push, not a document load — without
      // this, every page but the first would go uncounted.
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_exceptions: true,
      // Autocapture, rage clicks, heatmaps and session replay on. Every one stated
      // rather than inherited, so the capture surface is readable here and not only
      // in project settings or in this SDK version's defaults. Replay keeps its
      // default input masking: search terms come from ticket 04's explicit event,
      // never from the video.
      autocapture: true,
      rageclick: true,
      enable_heatmaps: true,
      disable_session_recording: false,
    });

    // `opt_out_capturing()` (what the /privacy button pokes) writes PostHog's own
    // `__ph_opt_in_out_<token>` record to localStorage, and that outlives our key:
    // opting out, reloading, then opting back in leaves the SDK permanently silent,
    // because on the opted-out load there is no live SDK for `opt_in_capturing()` to
    // reach. We only get here when our key says "not opted out", so a stored PostHog
    // opt-out is stale by definition. `clear_*` not `opt_in_*`: opting in *writes* a
    // record, and /privacy promises this device holds nothing it does not need.
    // ponytail: this load's initial $pageview is still dropped (init read the stale
    // record before we cleared it) — one lost pageview for someone who toggled the
    // switch off and on again. Clearing pre-init would mean hardcoding PostHog's
    // storage key; not worth it for that.
    if (posthog.has_opted_out_capturing()) posthog.clear_opt_in_out_capturing();

    // The /privacy opt-out button pokes `window.posthog` so turning analytics off
    // applies without a reload (lib/analytics.ts). The module import alone does not
    // set that global — only PostHog's own snippet loader does.
    Object.assign(window, { posthog });
  }, []);

  return null;
}
