# Decide v1 corpus zone policy: green-only or also red graph-only

Type: grilling
Status: resolved
Mode: HITL
Blocked by: —

## Question

At launch do we offer ONLY green-zone sites (ship .md + graph) and defer red-zone entirely, or also offer red-zone sites as graph-only bundles? This single call decides whether a runtime download gate and a separate graph-only bundle variant need to exist in v1 at all - green-only makes the whole gating mechanism a near-zero-code catalog filter, while also-red pulls the graph-verbatim audit and a gate branch into scope.

---

**Why session-sized / why this type:** Founder-only risk-appetite call; it must be answered before any gate or graph-only variant is built and it directly shapes the bundle-contents decision.

## Answer

Offer BOTH zones, gated by artifact: GREEN-license docs ship .md + graph; RED-license docs ship GRAPH-ONLY (no verbatim .md). This supports the broad 'list as much as possible' catalog. Consequence: the graph-only bundle variant + a download-time license gate ARE now in scope (not the near-zero-code green-only filter) — BUT they only need to exist once the first RED doc is actually BUILT; the launch-built set (shadcn, react — both green) doesn't exercise them yet. License vetting (ticket 13) is a ROLLING per-doc step, not a one-time launch gate. Paid bundles (post-paywall) must be COMMERCIALLY redistributable (MIT/Apache/BSD/CC0/CC-BY-with-attribution; NOT CC-BY-NC/ND).
