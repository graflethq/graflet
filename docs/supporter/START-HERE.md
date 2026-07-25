# Thank you

You bought a Graflet supporter licence. This file is what comes with it.

**Read this first, because it matters:** everything Graflet does is free. The CLI, the
documentation, the knowledge graphs, the catalog — all of it, for everyone, with or without a
licence. You did not buy access. You paid because you wanted the work to continue, and that is the
whole of it. If you expected to unlock something, ask for a refund and you will get one, no
questions asked, for 30 days.

What follows is how to use the thing you just supported.

---

## Install

```bash
npm i -g @graflethq/cli      # needs Node 18 or newer
```

Or run it without installing, if you have `uv`:

```bash
uvx graflet next.js
```

## Sign in, once

```bash
graflet login
```

This signs you in with GitHub. It is the only action that needs an account, and it exists so the
graph can be handed out safely — not to charge you.

## Pull a library

```bash
graflet next.js          # latest tracked release   -> ./next.js/
graflet next.js@16       # that exact release       -> ./next.js@16/
graflet react            # anything in the catalog
```

You get one directory holding both halves, kept apart:

```
next.js/
├── docs/…               the library's own Markdown, byte-for-byte from upstream
├── LICENSE              the docs' licence
└── graphify-out/
    └── graph.json       the knowledge graph
```

`docs/` is the official documentation as clean Markdown. `graph.json` is a precomputed map of that
library's concepts and APIs — the part that took hours of machine time so it doesn't have to take
yours.

## Watch for updates

```bash
graflet watch next.js
```

You get an email when that library's graph is rebuilt for a newer release.

## Point your AI tools at it

The files are plain and local. Nothing phones home. Feed `docs/` and `graph.json` to whatever you
use — an agent, an editor, a script. The graph is ordinary JSON; read it however you like.

---

## Your supporter badge

`graflet-supporter-badge.png` is in this folder. It is also here, permanently:

```
https://graflet.rnui.dev/badge/supporter.png
```

Put it wherever you like — a README, a profile, nowhere at all. It links back to the project. There
is one badge and every supporter gets the same one; it is a thank-you, not a rank.

---

## The catalog

Everything currently available: **https://graflet.rnui.dev**

## Refunds

30 days, in full, no questions asked. Reply to your receipt, or open an issue at
**https://github.com/graflethq/graflet**. See https://graflet.rnui.dev/refunds

## Problems, ideas, complaints

Open an issue: **https://github.com/graflethq/graflet**

Graflet is one developer. Replies are by hand and may take a day or two.

Thank you — genuinely.
