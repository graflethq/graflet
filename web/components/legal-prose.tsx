import type { ReactNode } from "react";

/**
 * Minimal prose primitives for the legal pages (ticket 07) — no typography plugin
 * installed, so a few styled tags keep Privacy / Terms / Attribution consistent
 * with the site's mono-heading / muted-body look.
 */

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="font-mono text-3xl font-semibold tracking-tight">{children}</h1>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className="mt-4 leading-relaxed text-muted-foreground">{children}</p>;
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 font-mono text-lg font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 leading-relaxed text-muted-foreground">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">{children}</ul>;
}

/** A link inside legal prose — internal route, external URL, or mailto alike. */
export function ProseLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="text-primary hover:underline">
      {children}
    </a>
  );
}
