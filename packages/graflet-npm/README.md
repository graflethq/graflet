<p align="center">
  <a href="https://github.com/graflethq/graflet">
    <img src="https://raw.githubusercontent.com/graflethq/graflet/main/assets/brand/graflet-og-1200x630.png" alt="graflet — Docs as a graph, not snippets." width="640">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@graflethq/cli"><img alt="npm" src="https://img.shields.io/npm/v/@graflethq/cli?logo=npm&label=npm"></a>
  <a href="https://pypi.org/project/graflet/"><img alt="PyPI" src="https://img.shields.io/pypi/v/graflet?logo=pypi&logoColor=white&label=PyPI"></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://x.com/graflethq"><img alt="@graflethq on X" src="https://img.shields.io/badge/follow-%40graflethq-111?logo=x&logoColor=white"></a>
</p>

**Docs as a graph, not snippets.**

Precomputed knowledge graphs of versioned library docs, for AI agents. One graflet = one library at one version.

> Context7 sends your agent snippets to read; **graflet** sends the graph to traverse.

## Run with no install

```bash
npx @graflethq/cli   # Node — installs command `graflet`
uvx graflet          # Python (uv) — same tool, published to PyPI
```

> npm blocks the bare name `graflet` (too similar to `leaflet`), so the npm package is scoped `@graflethq/cli`; the command it installs is still `graflet`. PyPI keeps the bare `graflet`.

> Spelled **g-r-a-f-l-e-t**, no p-h.

_Early placeholder release; the real CLI lands soon._
