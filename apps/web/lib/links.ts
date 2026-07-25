/**
 * Outbound links used by the nav + hero + support/footer. Graflet brand; repo is
 * graflethq/graflet. sponsors + buyMeACoffee targets are best-guess (@graflethq)
 * — verify they exist. No paywall link ever (ADR-0005).
 */
export const LINKS = {
  github: "https://github.com/graflethq/graflet",
  docs: "https://github.com/graflethq/graflet#readme",
  license: "https://github.com/graflethq/graflet/blob/main/LICENSE",
  sponsors: "https://github.com/sponsors/graflethq",
  buyMeACoffee: "https://buymeacoffee.com/graflethq",
  // The engine behind every graph in the catalog, and the source of the hero's
  // token claim — "context-stuffing … costs roughly 20x the tokens" (BENCHMARKS.md,
  // "Results: code intelligence"). v8 is that repo's default branch.
  graphify: "https://github.com/Graphify-Labs/graphify",
  graphifyBenchmarks: "https://github.com/Graphify-Labs/graphify/blob/v8/BENCHMARKS.md",
} as const;
