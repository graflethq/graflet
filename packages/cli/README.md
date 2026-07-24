<p align="center">
  <a href="https://graflet.rnui.dev">
    <img src="https://raw.githubusercontent.com/graflethq/graflet/main/assets/brand/graflet-og-1200x630.png" alt="graflet — Docs as a graph, not snippets." width="640">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@graflethq/cli"><img alt="npm" src="https://img.shields.io/npm/v/@graflethq/cli?logo=npm&label=npm"></a>
  <a href="https://pypi.org/project/graflet/"><img alt="PyPI" src="https://img.shields.io/pypi/v/graflet?logo=pypi&logoColor=white&label=PyPI"></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://graflet.rnui.dev"><img alt="graflet.rnui.dev" src="https://img.shields.io/badge/site-graflet.rnui.dev-14161D?logo=cloudflare&logoColor=F6A821"></a>
</p>

**Docs as a graph, not snippets.**

Precomputed knowledge graphs of versioned library docs, for AI coding agents. One graflet = one
library at one release. `graflet <slug>` downloads a library's documentation Markdown **plus** a
pre-built knowledge graph of those docs, both pinned to the same upstream commit.

## Install

```bash
npm i -g @graflethq/cli   # needs Node >= 18
```

## Use

```bash
graflet login          # sign in with GitHub (once) — the one action that needs an account
graflet next.js        # latest tracked release  -> ./next.js/
graflet next.js@16     # that release, pinned     -> ./next.js@16/
graflet watch next.js  # get emailed when the graph updates
```

Each download writes one directory with the graph (`graph.json`, `graph.html`, `GRAPH_REPORT.md`,
`savings.json`, `meta.json`) **and** the library's own docs Markdown, byte-for-byte from upstream at
the pinned commit. The Markdown is fetched anonymously from the library's public repo; the graph is
streamed from a broker after sign-in, so you never hold a token for the private graph repo.

For CI / headless use, skip the browser with a bearer you already hold:

```bash
export GRAFLET_TOKEN=<bearer>   # authenticate without a browser, without writing the keyring
```

Browse the catalog at **[graflet.rnui.dev](https://graflet.rnui.dev)**. Full design, ADRs and source:
**[github.com/graflethq/graflet](https://github.com/graflethq/graflet)**.

## Naming

Spelled **g-r-a-f-l-e-t**, no p-h — from *graphlet*, a small induced subgraph. npm blocks the bare
name (too close to `leaflet`), so the package is scoped `@graflethq/cli`; the installed command is
`graflet`. PyPI keeps bare [`graflet`](https://pypi.org/project/graflet/).

## License

MIT — © 2026 MD. MOHIBUR RAHMAN.
