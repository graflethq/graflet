<p align="center">
  <a href="https://github.com/graflethq/graflet">
    <img src="https://raw.githubusercontent.com/graflethq/graflet/main/assets/brand/graflet-og-1200x630.png" alt="graflet — Docs as a graph, not snippets." width="640">
  </a>
</p>

<p align="center">
  <a href="https://pypi.org/project/graflet/"><img alt="PyPI" src="https://img.shields.io/pypi/v/graflet?logo=pypi&logoColor=white&label=PyPI"></a>
  <a href="https://www.npmjs.com/package/@graflethq/cli"><img alt="npm" src="https://img.shields.io/npm/v/@graflethq/cli?logo=npm&label=npm"></a>
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <a href="https://x.com/graflethq"><img alt="@graflethq on X" src="https://img.shields.io/badge/follow-%40graflethq-111?logo=x&logoColor=white"></a>
</p>

**Docs as a graph, not snippets.**

Precomputed knowledge graphs of versioned library docs, for AI agents. One graflet = one library at
one release.

## The CLI is a Node tool

graflet's command-line tool is published to npm as
**[`@graflethq/cli`](https://www.npmjs.com/package/@graflethq/cli)**. Install it directly:

```bash
npm i -g @graflethq/cli   # needs Node >= 18
graflet next.js
```

## This PyPI package is a launcher

`pipx install graflet` (or `pip install graflet`) installs a thin launcher, **not** a Python
reimplementation. When Node is on your PATH it hands off to the real CLI via `npx`:

```bash
pipx install graflet
graflet next.js          # → npx @graflethq/cli next.js
```

Without Node it prints the `npm i -g @graflethq/cli` install line above.

> Spelled **g-r-a-f-l-e-t**, no p-h.

Catalog & docs: **[graflet.rnui.dev](https://graflet.rnui.dev)** · Source:
**[github.com/graflethq/graflet](https://github.com/graflethq/graflet)** · MIT.
