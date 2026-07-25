/**
 * Outbound links used by the nav + hero + support/footer. Graflet brand; repo is
 * graflethq/graflet. Still no paywall link ever — the supporter licence is a
 * same-origin /support route, not a gate, and it belongs to no product feature
 * (ADR-0005 as amended by ADR-0009).
 *
 * `sponsors` and `buyMeACoffee` used to live here as best guesses at @graflethq
 * URLs. Neither existed — buymeacoffee.com/graflethq 404s and the org has no
 * sponsors listing — so they shipped as dead buttons. Don't add a funding link
 * back until the destination is real; check it, don't infer it from the handle.
 */
export const LINKS = {
  github: "https://github.com/graflethq/graflet",
  docs: "https://github.com/graflethq/graflet#readme",
  license: "https://github.com/graflethq/graflet/blob/main/LICENSE",
  // The engine behind every graph in the catalog, and the source of the hero's
  // token claim — "context-stuffing … costs roughly 20x the tokens" (BENCHMARKS.md,
  // "Results: code intelligence"). v8 is that repo's default branch.
  graphify: "https://github.com/Graphify-Labs/graphify",
  graphifyBenchmarks: "https://github.com/Graphify-Labs/graphify/blob/v8/BENCHMARKS.md",
} as const;
