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

A download reports each step as it happens — the two sources stream in parallel:

```
$ graflet next.js
graflet · next.js → ./next.js/

✔ Resolved 16 → 2f9d939 · docs and graph aligned
✔ Downloaded docs → 312 files (18 MB)
✔ Fetched graph → 1,204 nodes · 3,880 edges

Done in 24s
Saved ~6h 12m of local build · ~$0.94 in API cost
```

All of that is on **stderr**. Stdout carries exactly one line — the absolute destination
path — so `cd "$(graflet next.js)"` works with no parsing. Piped or in CI, the same words
print as plain lines with no spinner and no escape codes.

Each download writes one directory holding both sources, kept apart:

```
next.js/
├── docs/…               the library's own Markdown, byte-for-byte from upstream
├── LICENSE              the docs' license
└── graphify-out/        the graph
    ├── graph.json
    ├── graph.html
    ├── GRAPH_REPORT.md
    ├── savings.json
    └── meta.json
```

`graphify-out/` is the same folder name [graphify](https://github.com/mrpmohiburrahman/graphify)
writes, so running it over the docs yourself lands in the same place. The Markdown is fetched
anonymously from the library's public repo at the pinned commit; the graph is streamed from a broker
after sign-in, so you never hold a token for the private graph repo.

For CI / headless use, skip the browser with a bearer you already hold:

```bash
export GRAFLET_TOKEN=<bearer>   # authenticate without a browser, without writing the keyring
```

## Telemetry — off unless you say yes

**Nothing is sent unless you opt in.** The first time you run a real command in a terminal,
graflet asks once whether it may send anonymous usage stats. The default is no, a bare Enter
is no, and it never asks again:

```bash
graflet telemetry        # show the current setting and where it's stored
graflet telemetry on     # opt in
graflet telemetry off    # opt back out, at any time
```

Two environment variables hard-disable it regardless of what you answered:

```bash
export GRAFLET_TELEMETRY=0   # graflet's own switch
export DO_NOT_TRACK=1        # the cross-tool convention (consoledonottrack.com)
```

A non-interactive run — CI, a pipe, no terminal — **never asks and never sends**, whatever is
stored. The answer lives in `~/.config/graflet/telemetry.json` (or `$XDG_CONFIG_HOME`), next to
the token fallback.

If you do opt in, four events are sent to [PostHog](https://posthog.com) (US region), and
nothing else:

| Event | What travels with it |
|---|---|
| `cli_command_run` | the subcommand name (`login`, `watch`, `download`, …) and the graflet version |
| `cli_login_completed` | — |
| `cli_download_completed` | the doc slug, the resolved version, how long it took, how many bytes |
| `cli_download_failed` | a fixed reason label (`auth_expired`, `not_found`, `transfer_failed`, …) |

**Never sent:** file paths, file names, your arguments, your hostname, your username, your
environment, or the contents of anything you download. Your IP address isn't stored either — every
event carries `$ip: null`, so no location is derived from it. Before you sign in the events are
keyed to a random id generated on your machine; signing in attaches them to your GitHub id, and
`graflet logout` discards both. Full policy: **[graflet.rnui.dev/privacy](https://graflet.rnui.dev/privacy)**.

Browse the catalog at **[graflet.rnui.dev](https://graflet.rnui.dev)**. Full design, ADRs and source:
**[github.com/graflethq/graflet](https://github.com/graflethq/graflet)**.

## Naming

Spelled **g-r-a-f-l-e-t**, no p-h — from *graphlet*, a small induced subgraph. npm blocks the bare
name (too close to `leaflet`), so the package is scoped `@graflethq/cli`; the installed command is
`graflet`. PyPI keeps bare [`graflet`](https://pypi.org/project/graflet/).

## License

MIT — © 2026 MD. MOHIBUR RAHMAN.
