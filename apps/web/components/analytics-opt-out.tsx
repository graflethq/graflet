"use client";

import { useEffect, useState } from "react";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics";

/**
 * The opt-out control on the privacy page (ADR-0010, ticket 02). The stored
 * choice is per-device, so it can only be read after mount — until then the
 * button is disabled rather than guessing a state and flipping under the reader.
 */
export function AnalyticsOptOut() {
  const [optedOut, setOptedOut] = useState<boolean | null>(null);

  useEffect(() => setOptedOut(isAnalyticsOptedOut()), []);

  function toggle() {
    const next = !optedOut;
    setAnalyticsOptOut(next);
    setOptedOut(next);
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-5">
      <button
        type="button"
        onClick={toggle}
        disabled={optedOut === null}
        className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-mono text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {optedOut ? "Turn analytics back on" : "Turn analytics off"}
      </button>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {optedOut === null
          ? "Checking this browser…"
          : optedOut
            ? "Analytics is off in this browser. Nothing is being measured."
            : "Analytics is on in this browser. Turning it off takes effect immediately."}
      </p>
    </div>
  );
}
