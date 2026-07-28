# Design exports

Rendered brand and campaign assets, plus the design-component sources they come from.
Everything here is gitignored.

```
export/
  graflet Landing.dc.html              landing-page design
  Graflet Supporter Badge.dc.html      supporter badge, v1
  Graflet Supporter Badge v2.dc.html   supporter badge, v2 (current)
  support.js                           dc-runtime for the three files above

  social media posts/
    graflet Social Posts.dc.html       source of all 15 social exports
    Mark.dc.html                       the g-in-a-graph logo component
    Graph.dc.html                      background node-graph component
    TermBody.dc.html                   terminal-panel component
    support.js                         dc-runtime for this folder
    exports/                           all 15 renders, 5 variants x 3 sizes
    variant-5-mark/                    the three picked for posting
```

Both `support.js` copies are needed: `dc-import` resolves relative to the document, so each
folder of `.dc.html` files needs its own.

## The five variants

| variant | shows | status |
|---|---|---|
| v1-number | `116x` hero with the baseline stated underneath | ok |
| v2-benchmark | real `graphify benchmark` terminal output | ok |
| v3-arithmetic | 63 / $133.52 / 804 hours | **corrected 2026-07-26**, see below |
| v4-drift | installed 16.0.1 vs docs v15, broken connector | ok |
| v5-mark | logo, wordmark, tagline. No statistics | ok |

Sizes: `1200x1500` LinkedIn (4:5), `1600x900` X (16:9), `1200x1200` Reddit (1:1).

## Corrections applied 2026-07-26

**v3-arithmetic** said "of model spend, already paid" and "of local compute, already burned".
Both were false. $133.52 is a list-price reference (44,504,945 doc tokens x $3.00/Mtok at Sonnet
pricing, `cost_basis: single-pass-floor`) and 804 hours is extrapolated from one M1 Pro benchmark
(`time_basis: extrapolated`). Neither is money spent or time elapsed, since the real builds ran on
cheap and free providers, in parallel. Labels now read "to graph them at Sonnet list prices" and
"to graph them on a laptop instead", which is true and is also the more useful framing: it is the
reader's avoided cost, not the maintainer's receipt.

**v5-mark** footer said `63 libraries · free · MIT · graflet.rnui.dev`. Now reads
`Free · MIT · graflet.rnui.dev`. Dropping the count also removes the need to re-export whenever
the catalog changes.

## Re-rendering

The `.dc.html` source is the truth; the PNGs are disposable. To re-render one node, extract it into
a standalone wrapper, serve the folder over HTTP so `dc-import` can fetch its components, and
screenshot headless at the exact node size:

```bash
cd "social media posts"
python3 -m http.server 8777 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,1500 --virtual-time-budget=8000 \
  --screenshot=out.png "http://localhost:8777/<wrapper>.html"
```

The wrapper must carry `font-family: Geist, Inter, system-ui, sans-serif` on `html, body`. That
declaration lives on an outer container div in the source document, so a wrapper that omits it
silently falls back to Times for all body copy while the monospace type still looks correct.
