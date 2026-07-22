# Decide what one shipped bundle contains and what its product manifest declares

Type: grilling
Status: open
Mode: HITL
Blocked by: 03, 16

## Question

With the real pruned bundle in hand: does v1 ship the interactive graph.html and the score/report, or graph.json only? Is there a README + attribution note inside (LICENSE/NOTICE retention is already settled)? And what fields does the NEW product manifest carry - source site + URL, scrape date, content license, graph score, node/edge counts, file list, attribution - distinct from graphify's internal manifest.json? (Whether a graph-only variant exists at all is already set by the zone-policy ticket.)

---

**Why session-sized / why this type:** What-to-include and the manifest fields are founder calls best made reacting to the real pruned bundle; the green/red variant question is inherited from zone-policy so this ticket only picks artifacts + manifest - and those fields become the catalog columns provisioning creates.

## Update

The product manifest now also declares: the 4 savings metrics (from savings.json) and the catalog `status` (`ready`/`graphifying`). These become catalog columns (ticket 21).
