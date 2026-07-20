import { Button } from "@/components/ui/button";
import { LINKS } from "@/lib/links";

/**
 * The static body + footer of the landing page (ticket 05). Copy is verbatim from
 * the chosen design (Frame A). Server components — no client JS — for SEO and speed.
 * The only live section (the four stat tiles) is `StatTiles`, kept separate because
 * it reads the catalog.
 */

const WHAT_YOU_GET = [
  {
    eyebrow: "01 · MARKDOWN",
    title: "Docs as Markdown",
    body: "Every page of the official docs, downloaded as clean Markdown you can grep, feed, and version — pinned to the exact release you install.",
  },
  {
    eyebrow: "02 · THE VALUE",
    title: "Knowledge graph",
    body: "A pre-built graph of concepts, APIs, and how they connect — as an interactive view and a machine-readable graph.json. This is the context your AI actually needs.",
  },
] as const;

export function WhatYouGet() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {WHAT_YOU_GET.map((c) => (
          <div key={c.title} className="rounded-xl border border-border bg-card p-6">
            <div className="font-mono text-xs tracking-wide text-primary">{c.eyebrow}</div>
            <h3 className="mt-3 font-mono text-xl font-semibold">{c.title}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Run one command", body: "npx docs-kg react — no config, no account to start." },
  {
    n: "02",
    title: "Sign in with GitHub",
    body: "One click, and only to download the graph. Install, browse and copy stay free.",
  },
  {
    n: "03",
    title: "We fetch both",
    body: "Docs pulled from the upstream project, the knowledge graph from our backend.",
  },
  { n: "04", title: "Land locally, aligned", body: "docs/*.md and graph.json on disk, pinned to the same release." },
] as const;

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
      <h2 className="font-mono text-2xl font-semibold tracking-tight">How it works</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-border bg-card p-5">
            <div className="font-mono text-2xl font-bold text-primary/70">{s.n}</div>
            <h3 className="mt-3 font-mono text-base font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WhyGraph() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-8 sm:p-10">
        <div className="font-mono text-xs tracking-wide text-primary">WHY A KNOWLEDGE GRAPH</div>
        <h2 className="mt-3 max-w-2xl font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          Raw docs are flat. A graph knows how things connect.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          The graph encodes relationships — which API calls which, what depends on what, which concepts connect — so
          your AI retrieves the right context instead of dumping whole pages. Cheaper prompts, sharper answers, fewer
          hallucinations.
        </p>
      </div>
    </section>
  );
}

/** Support: Star / Sponsors / Buy Me a Coffee — the only monetization (ADR-0005: no paywall). */
export function Support() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center sm:p-10">
        <h2 className="font-mono text-2xl font-semibold tracking-tight">Support the project</h2>
        <p className="mt-2 text-muted-foreground">Free and open source. No paid plans — ever.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 font-mono text-sm">
          <Button asChild size="lg">
            <a href={LINKS.github}>★ Star on GitHub</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={LINKS.sponsors}>♥ GitHub Sponsors</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={LINKS.buyMeACoffee}>☕ Buy Me a Coffee</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 font-mono text-xs text-muted-foreground sm:px-6">
        <span>
          docs<span className="text-primary">-</span>kg · Free &amp; open source · MIT
        </span>
        <div className="flex items-center gap-6">
          <a href="#catalog" className="hover:text-foreground">Catalog</a>
          <a href={LINKS.docs} className="hover:text-foreground">Docs</a>
          <a href={LINKS.github} className="hover:text-foreground">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
