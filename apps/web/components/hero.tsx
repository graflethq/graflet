import { CopyButton } from "@/components/copy-button";
import { buildInstallCommand } from "@/lib/command";
import { LINKS } from "@/lib/links";

// The one command, from the shared builder so the hero and the catalog rows can
// never drift (ticket 03).
const HERO_COMMAND = buildInstallCommand("react");

/**
 * Compact hero: one headline, one sourced claim, one command — sized so the first
 * catalog rows sit above the fold on a ~700px-tall viewport. The example-output
 * terminal now lives further down the page (`TerminalDemo` in landing-sections).
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-10 pb-8 text-center sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[260px] bg-[radial-gradient(60%_90%_at_50%_0%,rgba(78,240,140,0.09),transparent_70%)]"
      />

      <h1 className="mx-auto max-w-3xl font-mono text-3xl font-bold tracking-tight sm:text-4xl">
        Knowledge graphs for library docs
      </h1>

      {/* The 95% is graphify's own benchmark (20x the tokens for whole-repo context
          stuffing), so it links to BENCHMARKS.md and keeps its "instead of dumping
          whole docs" baseline in the sentence — never a bare percentage. */}
      <p className="mx-auto mt-4 max-w-2xl text-balance leading-relaxed text-muted-foreground">
        Built with{" "}
        <a href={LINKS.graphify} className="underline underline-offset-4 hover:text-foreground">
          graphify
        </a>{" "}
        — query the graph instead of dumping whole docs.{" "}
        <a
          href={LINKS.graphifyBenchmarks}
          className="text-primary underline underline-offset-4 hover:opacity-80"
        >
          Up to 95% fewer tokens
        </a>
        .
      </p>

      <div className="mx-auto mt-6 inline-flex max-w-full items-center gap-3 rounded-xl border border-border bg-card py-2 pr-2 pl-4 font-mono">
        <span className="text-primary">$</span>
        <span className="truncate text-sm text-foreground">{HERO_COMMAND}</span>
        <CopyButton
          value={HERO_COMMAND}
          idleLabel="Copy"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        />
      </div>
    </section>
  );
}
