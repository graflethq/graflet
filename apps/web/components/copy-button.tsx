"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Copy-a-string button, shared by the hero command pill and every catalog row.
 * ADR-0005: copying writes to the clipboard and NOTHING else — no network, no
 * auth. Shows a transient "copied" label, then reverts.
 */
export function CopyButton({
  value,
  idleLabel,
  copiedLabel = "Copied ✓",
  className,
}: {
  value: string;
  idleLabel: ReactNode;
  copiedLabel?: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={`Copy command: ${value}`}
      data-copied={copied || undefined}
      onClick={() => {
        // Pure clipboard write — no fetch, no sign-in (ADR-0005). Only flip to the
        // "copied" label when the write actually succeeds, so it never lies (e.g. on
        // a non-secure context where navigator.clipboard is undefined).
        navigator.clipboard?.writeText(value).then(
          () => setCopied(true),
          () => {},
        );
      }}
      className={className}
    >
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}
