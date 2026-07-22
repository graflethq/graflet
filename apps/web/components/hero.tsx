import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { buildInstallCommand } from "@/lib/command";
import { LINKS } from "@/lib/links";

// The one command, from the shared builder so the hero and the catalog rows can
// never drift (ticket 03).
const HERO_COMMAND = buildInstallCommand("react");

export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_90%_at_50%_0%,rgba(78,240,140,0.09),transparent_70%)]"
      />

      <span className="inline-block rounded-full border border-primary/30 px-3 py-1 font-mono text-xs font-medium text-primary">
        FREE · OPEN SOURCE · MIT
      </span>

      <h1 className="mx-auto mt-6 max-w-3xl font-mono text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
        Ship your AI the docs —<br />
        <span className="text-primary">and the graph.</span>
      </h1>

      <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
        One command downloads a library&apos;s docs as Markdown plus a pre-built knowledge graph,
        pinned to a release. Far better context for your AI, at a fraction of the tokens.
      </p>

      <div className="mx-auto mt-8 inline-flex max-w-full items-center gap-3 rounded-xl border border-border bg-card py-2 pr-2 pl-4 font-mono">
        <span className="text-primary">$</span>
        <span className="truncate text-sm text-foreground">{HERO_COMMAND}</span>
        <CopyButton
          value={HERO_COMMAND}
          idleLabel="Copy"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        />
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3 font-mono text-sm">
        <Button asChild size="lg">
          <a href="#catalog">Get started →</a>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={LINKS.github}>★ Star on GitHub</a>
        </Button>
      </div>

      <TerminalPanel />
    </section>
  );
}

/** Static, illustrative sample output — labelled as an example (not live data). */
function TerminalPanel() {
  return (
    <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-xl border border-border bg-[#0d0f12] text-left shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2.5 font-mono text-xs text-muted-foreground">react — graflet · example output</span>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-[1.75] text-[#cdd3da]">
        <span className="text-muted-foreground">$</span> uvx graflet react
        {"\n"}
        <span className="text-primary">✔</span> Resolved <span className="text-foreground">react@19.1.0</span>{" "}
        <span className="text-muted-foreground">(pinned)</span>
        {"\n"}
        <span className="text-primary">✔</span> Downloaded docs →{" "}
        <span className="text-muted-foreground">./graflet/react/*.md (312 files)</span>
        {"\n"}
        <span className="text-primary">✔</span> Fetched knowledge graph →{" "}
        <span className="text-muted-foreground">graph.json (1,204 nodes · 3,880 edges)</span>
        {"\n"}
        <span className="text-primary">✔</span> Aligned to release <span className="text-foreground">react@19.1.0</span>
        {"\n"}
        <span className="text-primary">Done</span> in 8m 12s · saved ~$0.42 in build cost
        <span className="ml-0.5 inline-block motion-safe:animate-pulse">▋</span>
      </pre>
    </div>
  );
}
