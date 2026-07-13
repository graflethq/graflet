# Build and zip the first real shadcn bundle to learn its true shape and size

Type: task
Status: open
Mode: AFK
Blocked by: 12

## Question

Take shadcn (MIT / green) through the offline pipeline - REUSE the existing graphify-out (don't re-scrape), prune every internal graphify working file (cache/, .graphify_analysis.json, date-stamped incremental dirs, .DS_Store, .sig, internal manifest.json), assemble the shippable set (graph.json, graph.html, GRAPH_REPORT.md, the .md files, LICENSE/NOTICE + attribution per the manifest spec), and zip it. Record concrete facts: total zip size, file count, what a user literally gets on unzip. (Upload is a separate ticket so shape-learning isn't blocked on Supabase.)

---

**Why session-sized / why this type:** No packaged bundle exists yet; its real bytes/shape feed the storage choice and the bundle-contents grilling, and it must emit attribution from the manifest spec - so it waits only on that spec (ticket 12), not on the full catalog vetting (shadcn is pre-confirmed green).

## Update

The bundle now also carries savings.json (see research/savings-metrics/REQUIREMENTS.md), produced by the extended graphify-and-score-html-md-report skill. First built bundles (shadcn, react) are GREEN → ship full .md + graph; the graph-only variant is deferred until the first RED doc is built.
